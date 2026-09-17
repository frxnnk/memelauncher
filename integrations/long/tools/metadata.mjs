import { createHash } from 'node:crypto';

const MAX_BYTES=1024*1024;
export function metadataFetchUrl(uri,gateway) {
  if(typeof uri!=='string' || /\s/.test(uri)) throw new Error('Metadata/image URI must be public HTTPS or IPFS');
  if(uri.startsWith('ipfs://')) {
    const path=uri.slice(7).replace(/^ipfs\//,'');
    if(!/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{20,})(\/[^?#]*)?$/.test(path) || path.split('/').includes('..'))
      throw new Error('Unsupported IPFS URI; use a complete CID and optional path');
    if(!gateway) throw new Error('Explicit metadataGateway required for IPFS; no silent public gateway fallback');
    const base=metadataFetchUrl(gateway);
    if(!base.endsWith('/ipfs/') || new URL(base).search) throw new Error('metadataGateway must end with /ipfs/');
    return base+path;
  }
  let url;
  try { url=new URL(uri); } catch { throw new Error('Invalid metadata/image URI'); }
  if(url.protocol!=='https:' || url.username || url.password || url.hash)
    throw new Error('Metadata/image URI requires HTTPS without credentials or fragment');
  if(url.hostname==='localhost' || url.hostname.endsWith('.localhost') || url.hostname.endsWith('.local') ||
    url.hostname.startsWith('[') || /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname))
    throw new Error('Metadata/image URI must use a public host name');
  return url.href;
}

export async function verifyMetadata(input, expected, fetcher=fetch) {
  let url=metadataFetchUrl(input.metadataURI,input.metadataGateway);
  const signal=AbortSignal.timeout(20000), redirects=[];
  let response;
  for(let hop=0;hop<=3;hop++) {
    response=await fetcher(url,{method:'GET',redirect:'manual',credentials:'omit',signal,
      headers:{accept:'application/json, application/octet-stream;q=0.8, text/plain;q=0.5'}});
    if([301,302,303,307,308].includes(response.status)) {
      await response.body?.cancel();
      if(hop===3) throw new Error('Metadata redirect limit exceeded');
      const location=response.headers.get('location');
      if(!location) throw new Error('Metadata redirect has no Location');
      const next=metadataFetchUrl(new URL(location,url).href);
      redirects.push({from:url,to:next,status:response.status}); url=next; continue;
    }
    break;
  }
  if(!response.ok) { await response.body?.cancel(); throw new Error(`Metadata HTTP ${response.status}`); }
  const length=response.headers.get('content-length');
  if(length!==null && Number(length)>MAX_BYTES) { await response.body?.cancel(); throw new Error('Metadata exceeds 1 MiB'); }
  if(!response.body) throw new Error('Metadata response has no body');
  const reader=response.body.getReader(),chunks=[];
  let size=0;
  try {
    for(;;) {
      const {done,value}=await reader.read(); if(done) break;
      size+=value.byteLength;
      if(size>MAX_BYTES) throw new Error('Metadata exceeds 1 MiB');
      chunks.push(Buffer.from(value));
    }
  } finally { await reader.cancel(); }
  const bytes=Buffer.concat(chunks),sha256=createHash('sha256').update(bytes).digest('hex');
  if(sha256!==input.metadataSha256.toLowerCase()) throw new Error('Metadata SHA256 differs from reviewed exact bytes');
  let metadata;
  try { metadata=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)); }
  catch { throw new Error('Metadata must be valid UTF-8 JSON'); }
  if(!metadata || Array.isArray(metadata) || typeof metadata!=='object') throw new Error('Metadata must be a JSON object');
  for(const key of ['name','description'])
    if(metadata[key]!==expected[key]) throw new Error(`Metadata ${key} differs from reviewed local draft; review provider schema or final text`);
  if(metadata.symbol!==undefined && metadata.symbol!==expected.symbol) throw new Error('Metadata symbol differs from reviewed local draft');
  const longSchema=Object.hasOwn(metadata,'image_hash');
  const imageURI=longSchema?metadata.image_hash:metadata.image;
  metadataFetchUrl(imageURI,input.metadataGateway);
  if(longSchema) {
    if(typeof metadata.fee_receiver!=='string' || metadata.fee_receiver.toLowerCase()!==input.feeRecipient?.toLowerCase())
      throw new Error('Metadata fee_receiver differs from selected feeRecipient');
    if(!Array.isArray(metadata.social_links)) throw new Error('Long metadata social_links must be an array');
  }
  if(metadata.image!==undefined && metadata.image_hash!==undefined && metadata.image!==metadata.image_hash)
    throw new Error('Conflicting metadata image and image_hash');
  return {status:'EXACT_METADATA_BYTES_VERIFIED',observedAt:new Date().toISOString(),
    uri:input.metadataURI,fetchUrl:url,redirects,sha256,bytes:bytes.length,
    contentType:response.headers.get('content-type'),originalBytesBase64:bytes.toString('base64'),metadata,
    schema:longSchema?'LONG_IMAGE_HASH':'IMAGE_URI',symbolStatus:metadata.symbol===undefined?'ABSENT_VERIFY_ONCHAIN_SYMBOL':'MATCH',imageURI,
    imageStatus:'URI_SYNTAX_CHECKED_CONTENT_NOT_DOWNLOADED',
    caveat:'A point-in-time public GET. Does not prove image content, persistence, IPFS pinning, URI immutability or future responses.'};
}
