export function referenceOptions(args:string[]) {
  if(args.length>1||args.some(a=>!['no-stimulus','silence-output'].includes(a))) throw new Error('Use no-stimulus or silence-output');
  return {hz:args.includes('no-stimulus')?0:100,silence:args.includes('silence-output')};
}
