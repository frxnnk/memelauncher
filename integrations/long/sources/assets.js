;!function(){try { var e="undefined"!=typeof globalThis?globalThis:"undefined"!=typeof global?global:"undefined"!=typeof window?window:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&((e._debugIds|| (e._debugIds={}))[n]="0fe2f737-1b4b-f94c-47a5-6bfc09bf28a8")}catch(e){}}();
(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,419666,e=>{"use strict";var t=e.i(385390),a=e.i(285851);let o=a.default.div`
  .loadingspinner {
    --square: 26px;
    --offset: 30px;
    --duration: 2.4s;
    --delay: 0.2s;
    --timing-function: ease-in-out;
    --in-duration: 0.4s;
    --in-delay: 0.1s;
    --in-timing-function: ease-out;
    width: calc( 3 * var(--offset) + var(--square));
    height: calc( 2 * var(--offset) + var(--square));
    padding: 0px;
    margin-left: auto;
    margin-right: auto;
    margin-top: 10px;
    margin-bottom: 30px;
    position: relative;
  }

  .loadingspinner div {
    display: inline-block;
    background: var(--accent-soft, #a3b8a6);
    border: none;
    border-radius: 4px;
    width: var(--square);
    height: var(--square);
    position: absolute;
    padding: 0px;
    margin: 0px;
    font-size: 6pt;
    color: black;
    opacity: 0.85;
  }

  .loadingspinner #square1 {
    left: calc( 0 * var(--offset) );
    top: calc( 0 * var(--offset) );
    animation: square1 var(--duration) var(--delay) var(--timing-function) infinite,
                 squarefadein var(--in-duration) calc(1 * var(--in-delay)) var(--in-timing-function) both;
  }

  .loadingspinner #square2 {
    left: calc( 0 * var(--offset) );
    top: calc( 1 * var(--offset) );
    animation: square2 var(--duration) var(--delay) var(--timing-function) infinite,
                squarefadein var(--in-duration) calc(1 * var(--in-delay)) var(--in-timing-function) both;
  }

  .loadingspinner #square3 {
    left: calc( 1 * var(--offset) );
    top: calc( 1 * var(--offset) );
    animation: square3 var(--duration) var(--delay) var(--timing-function) infinite,
                 squarefadein var(--in-duration) calc(2 * var(--in-delay)) var(--in-timing-function) both;
  }

  .loadingspinner #square4 {
    left: calc( 2 * var(--offset) );
    top: calc( 1 * var(--offset) );
    animation: square4 var(--duration) var(--delay) var(--timing-function) infinite,
                 squarefadein var(--in-duration) calc(3 * var(--in-delay)) var(--in-timing-function) both;
  }

  .loadingspinner #square5 {
    left: calc( 3 * var(--offset) );
    top: calc( 1 * var(--offset) );
    animation: square5 var(--duration) var(--delay) var(--timing-function) infinite,
                 squarefadein var(--in-duration) calc(4 * var(--in-delay)) var(--in-timing-function) both;
  }

  @keyframes square1 {
    0% {
      left: calc( 0 * var(--offset) );
      top: calc( 0 * var(--offset) );
    }

    8.333% {
      left: calc( 0 * var(--offset) );
      top: calc( 1 * var(--offset) );
    }

    100% {
      left: calc( 0 * var(--offset) );
      top: calc( 1 * var(--offset) );
    }
  }

  @keyframes square2 {
    0% {
      left: calc( 0 * var(--offset) );
      top: calc( 1 * var(--offset) );
    }

    8.333% {
      left: calc( 0 * var(--offset) );
      top: calc( 2 * var(--offset) );
    }

    16.67% {
      left: calc( 1 * var(--offset) );
      top: calc( 2 * var(--offset) );
    }

    25.00% {
      left: calc( 1 * var(--offset) );
      top: calc( 1 * var(--offset) );
    }

    83.33% {
      left: calc( 1 * var(--offset) );
      top: calc( 1 * var(--offset) );
    }

    91.67% {
      left: calc( 1 * var(--offset) );
      top: calc( 0 * var(--offset) );
    }

    100% {
      left: calc( 0 * var(--offset) );
      top: calc( 0 * var(--offset) );
    }
  }

  @keyframes square3 {
    0%,100% {
      left: calc( 1 * var(--offset) );
      top: calc( 1 * var(--offset) );
    }

    16.67% {
      left: calc( 1 * var(--offset) );
      top: calc( 1 * var(--offset) );
    }

    25.00% {
      left: calc( 1 * var(--offset) );
      top: calc( 0 * var(--offset) );
    }

    33.33% {
      left: calc( 2 * var(--offset) );
      top: calc( 0 * var(--offset) );
    }

    41.67% {
      left: calc( 2 * var(--offset) );
      top: calc( 1 * var(--offset) );
    }

    66.67% {
      left: calc( 2 * var(--offset) );
      top: calc( 1 * var(--offset) );
    }

    75.00% {
      left: calc( 2 * var(--offset) );
      top: calc( 2 * var(--offset) );
    }

    83.33% {
      left: calc( 1 * var(--offset) );
      top: calc( 2 * var(--offset) );
    }

    91.67% {
      left: calc( 1 * var(--offset) );
      top: calc( 1 * var(--offset) );
    }
  }

  @keyframes square4 {
    0% {
      left: calc( 2 * var(--offset) );
      top: calc( 1 * var(--offset) );
    }

    33.33% {
      left: calc( 2 * var(--offset) );
      top: calc( 1 * var(--offset) );
    }

    41.67% {
      left: calc( 2 * var(--offset) );
      top: calc( 2 * var(--offset) );
    }

    50.00% {
      left: calc( 3 * var(--offset) );
      top: calc( 2 * var(--offset) );
    }

    58.33% {
      left: calc( 3 * var(--offset) );
      top: calc( 1 * var(--offset) );
    }

    100% {
      left: calc( 3 * var(--offset) );
      top: calc( 1 * var(--offset) );
    }
  }

  @keyframes square5 {
    0% {
      left: calc( 3 * var(--offset) );
      top: calc( 1 * var(--offset) );
    }

    50.00% {
      left: calc( 3 * var(--offset) );
      top: calc( 1 * var(--offset) );
    }

    58.33% {
      left: calc( 3 * var(--offset) );
      top: calc( 0 * var(--offset) );
    }

    66.67% {
      left: calc( 2 * var(--offset) );
      top: calc( 0 * var(--offset) );
    }

    75.00% {
      left: calc( 2 * var(--offset) );
      top: calc( 1 * var(--offset) );
    }

    100% {
      left: calc( 2 * var(--offset) );
      top: calc( 1 * var(--offset) );
    }
  }

  @keyframes squarefadein {
    0% {
      transform: scale(0.75);
      opacity: 0.0;
    }

    100% {
      transform: scale(1.0);
      opacity: 1.0;
    }
  }
`;e.s(["default",0,()=>(0,t.jsx)(o,{children:(0,t.jsxs)("div",{className:"loadingspinner",children:[(0,t.jsx)("div",{id:"square1"}),(0,t.jsx)("div",{id:"square2"}),(0,t.jsx)("div",{id:"square3"}),(0,t.jsx)("div",{id:"square4"}),(0,t.jsx)("div",{id:"square5"})]})})])},545058,e=>{e.v({center:"style-module__NWyqAW__center",coin:"style-module__NWyqAW__coin",counter:"style-module__NWyqAW__counter",orbit:"style-module__NWyqAW__orbit",ring:"style-module__NWyqAW__ring","ring-spin":"style-module__NWyqAW__ring-spin"})},604405,e=>{"use strict";var t=e.i(385390),a=e.i(898554),o=e.i(545058);let r=["AAPL","NVDA","TSLA","MSFT","COIN","GOOGL","PLTR","SPCX"];function s({symbols:e=r,coinSize:s=84,priority:i=!1,center:c,className:n}){return(0,t.jsxs)("div",{className:n?`${o.default.ring} ${n}`:o.default.ring,style:{"--n":e.length},"aria-hidden":"true",children:[e.map((e,r)=>(0,t.jsx)("div",{className:o.default.orbit,style:{"--i":r},children:(0,t.jsx)("div",{className:o.default.counter,children:(0,t.jsx)(a.default,{src:`/robinhood-coins/${e.toLowerCase()}.png`,alt:"",width:s,height:s,unoptimized:!0,priority:i,className:o.default.coin})})},e)),c&&(0,t.jsx)("div",{className:o.default.center,children:c})]})}e.s(["default",()=>s])},485873,766287,e=>{"use strict";var t=e.i(677549);let a=new Map(t.ROBINHOOD_MOST_LIQUID_ASSETS.map((e,t)=>[e.symbol,t]));function o(e){let o=e.trim().toLowerCase();return o?t.ROBINHOOD_ASSETS.filter(e=>!((0,t.isNvda3xNumeraire)(e.address)&&!1===e.available)).map(e=>{let t,a;return{asset:e,rank:(t=e.symbol.toLowerCase(),a=e.name.toLowerCase(),t===o?0:t.startsWith(o)?1:a.split(/\s+/).some(e=>e.startsWith(o))?2:t.includes(o)||a.includes(o)?3:-1)}}).filter(e=>e.rank>=0).sort((e,t)=>{if(e.rank!==t.rank)return e.rank-t.rank;let o=a.get(e.asset.symbol)??Number.MAX_SAFE_INTEGER,r=a.get(t.asset.symbol)??Number.MAX_SAFE_INTEGER;return o!==r?o-r:e.asset.symbol.localeCompare(t.asset.symbol)}).map(e=>e.asset):t.ROBINHOOD_MOST_LIQUID_ASSETS}e.s(["matchAssets",()=>o],485873);var r=e.i(477707);function s(e){let t=(0,r.useCallback)(t=>{let a=window.matchMedia(e);return a.addEventListener("change",t),()=>a.removeEventListener("change",t)},[e]);return(0,r.useSyncExternalStore)(t,()=>window.matchMedia(e).matches,()=>!1)}e.s(["useMatchMedia",()=>s],766287)},421935,e=>{"use strict";var t,a=e.i(378386),o=((t={}).TIMEOUT="TIMEOUT",t.USER_REJECTED="USER_REJECTED",t.NETWORK_ERROR="NETWORK_ERROR",t.WALLET_DISCONNECTED="WALLET_DISCONNECTED",t.UNKNOWN="UNKNOWN",t);function r(e,t,a){return{type:e,message:t,originalError:a}}function s(e){if(e instanceof a.UserRejectedRequestError)return!0;if(e instanceof Error){let t=e.message.toLowerCase();return t.includes("user rejected")||t.includes("user denied")||t.includes("rejected the request")||t.includes("user cancelled")||t.includes("user canceled")||t.includes("action_rejected")}return!1}function i(e){return s(e)?r("USER_REJECTED","Transaction was rejected. Please try again when ready.",e instanceof Error?e:void 0):!function(e){if(e instanceof Error){let t=e.message.toLowerCase();return t.includes("disconnected")||t.includes("not connected")||t.includes("wallet not found")||t.includes("no provider")||t.includes("provider not found")}return!1}(e)?!function(e){if(e instanceof Error){let t=e.message.toLowerCase();return t.includes("network")||t.includes("connection")||t.includes("timeout")||t.includes("econnrefused")||t.includes("enotfound")||t.includes("fetch failed")||t.includes("failed to fetch")}return!1}(e)?r("UNKNOWN",e instanceof Error?e.message:"An unknown error occurred",e instanceof Error?e:void 0):r("NETWORK_ERROR","Network error occurred. Please check your connection and try again.",e instanceof Error?e:void 0):r("WALLET_DISCONNECTED","Wallet disconnected. Please refresh the page and try again.",e instanceof Error?e:void 0)}class c extends Error{type="TIMEOUT";constructor(e=6e4){super(`Wallet provider did not respond within ${e/1e3} seconds. Please check your wallet and try again.`),this.name="WalletTimeoutError"}}async function n(e,t=6e4,a){return new Promise((o,r)=>{let s=null,i=!1,n=()=>{s&&(clearTimeout(s),s=null)};s=setTimeout(()=>{i||(i=!0,n(),a?.(),r(new c(t)))},t),e().then(e=>{i||(i=!0,n(),o(e))}).catch(e=>{i||(i=!0,n(),r(e))})})}function l(e){if(e instanceof c)return!0;let t=i(e);return"TIMEOUT"===t.type||"NETWORK_ERROR"===t.type||"WALLET_DISCONNECTED"===t.type}e.s(["WalletErrorType",()=>o,"WalletTimeoutError",()=>c,"classifyWalletError",()=>i,"isRetryableError",()=>l,"isUserRejectionError",()=>s,"withWalletTimeout",()=>n])},636725,e=>{e.v({badge:"style-module__9tK_0G__badge",badgeTiny:"style-module__9tK_0G__badgeTiny",coin:"style-module__9tK_0G__coin",wrap:"style-module__9tK_0G__wrap"})},598853,e=>{"use strict";var t=e.i(385390),a=e.i(803215),o=e.i(636725);function r({cfg:e,size:r=36,badgeScale:s=.26,className:i}){let c=r<=20;return(0,t.jsxs)("span",{className:i?`${o.default.wrap} ${i}`:o.default.wrap,style:{inlineSize:r,blockSize:r},children:[(0,t.jsx)(a.default,{symbol:e.underlyingSymbol,size:r,className:o.default.coin}),(0,t.jsxs)("span",{className:c?`${o.default.badge} ${o.default.badgeTiny}`:o.default.badge,style:c?void 0:{fontSize:Math.max(9,Math.round(r*s))},children:[e.targetLeverage,"×"]})]})}e.s(["default",()=>r])},969047,e=>{"use strict";var t=e.i(774726);let a=[{address:(0,t.getAddress)("0xF51fb54DE60f6e16252E852A5Ed0E60B8307606A"),name:"NVDA 3x Long",ticker:"NVDAx3L",accountIndex:14991,targetLeverage:3,underlyingSymbol:"NVDA",poolFee:3e3,poolTickSpacing:30},{address:(0,t.getAddress)("0xac55570c2476BF13Ce1517Ab20f6d7b660d8400d"),name:"NVDA 5x Long",ticker:"NVDAx5L",accountIndex:18793,targetLeverage:5,underlyingSymbol:"NVDA",poolFee:3e3,poolTickSpacing:30,unlisted:!0}],o=a[0];function r(e){if(!e)return;let t=e.toLowerCase();return a.find(e=>e.address.toLowerCase()===t)}e.s(["LONGX_VAULTS",0,a,"NVDA3X_VAULT",0,o,"findLongxVault",()=>r])},524360,e=>{e.v({coin:"style-module__qOslSW__coin",fallback:"style-module__qOslSW__fallback"})},803215,e=>{"use strict";var t=e.i(385390),a=e.i(898554),o=e.i(460880),r=e.i(524360);function s({symbol:e,size:s=24,src:i,className:c}){let n=i??(0,o.stockCoinSrc)(e),l=c?`${r.default.coin} ${c}`:r.default.coin;if(n)return(0,t.jsx)(a.default,{src:n,alt:e,width:s,height:s,unoptimized:!0,className:l});let f=e.slice(0,4).toUpperCase();return(0,t.jsx)("span",{className:c?`${r.default.fallback} ${c}`:r.default.fallback,style:{width:s,height:s,fontSize:Math.max(6,Math.round(.25*s))},children:f.length>=4?(0,t.jsxs)(t.Fragment,{children:[f.slice(0,2),(0,t.jsx)("br",{}),f.slice(2)]}):f})}e.s(["default",()=>s])},847993,e=>{"use strict";e.s(["erc6492MagicBytes",0,"0x6492649264926492649264926492649264926492649264926492649264926492","zeroHash",0,"0x0000000000000000000000000000000000000000000000000000000000000000"])},677549,e=>{"use strict";var t=e.i(330891),a=e.i(774726),o=e.i(886247);let r="1"===t.default.env.NEXT_PUBLIC_ROBINHOOD_NVDA3X_LAUNCH,s=(e,t,r,s,i,c,n)=>({symbol:e,name:t,kind:r,address:s===o.zeroAddress?o.zeroAddress:(0,a.getAddress)(s),decimals:i,feedAddress:c?(0,a.getAddress)(c):void 0,feedDecimals:8,heartbeatSeconds:86400,...n}),i=[s("ETH","Ether","native",o.zeroAddress,18,"0x78F3556b67E17Df817D51Ef5a990cDaF09E8d3A9"),s("USDG","Global Dollar","stable","0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",6,"0x61B7e5650328764B076A108EFF5fa7282a1B9aD2"),s("AI","ArtificialINU","token","0x2E8c31162b855A2ffa90F6F8634643Ad6F111e18",18,void 0,{isNew:!0}),s("NVDAx3L","NVDA 3x Long","token","0xF51fb54DE60f6e16252E852A5Ed0E60B8307606A",18,void 0,r?{isNew:!0}:{available:!1}),s("AAPL","Apple","stock","0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9",18,"0x6B22A786bAa607d76728168703a39Ea9C99f2cD0"),s("AMC","AMC Entertainment","stock","0x05a3d1Cd21d0C88145E82600E62e7E496e0F222B",18,void 0),s("AMD","Advanced Micro Devices","stock","0x86923f96303D656E4aa86D9d42D1e57ad2023fdC",18,"0x943A29E7ae51A4798823ca9eEd2ed533B2A22C72"),s("AMZN","Amazon","stock","0x12f190a9F9d7D37a250758b26824B97CE941bF54",18,"0xD5a1508ceD74c084eBf3cBe853e2C968fB2a651C"),s("ASML","ASML Holding","stock","0x47F93d52cBeC7C6D2CfC080e154002370a60dAEA",18,"0xB4106147E8cce40b7d46124090d373A71b70f87D"),s("BA","Boeing","stock","0x4D21483a44Bf67a86b77E3dA301411880797D452",18,void 0),s("BABA","Alibaba","stock","0xad25Ac6C84D497db898fa1E8387bf6Af3532a1c4",18,"0x62Cc8F9b5f56a33c9C8A60c8B92779f523c4E984",{available:!1}),s("BB","BlackBerry","stock","0x48E39E56aCdbA37b09020C0b734A613C9a2f100A",18,void 0),s("BE","Bloom Energy","stock","0x822CC93fFD030293E9842c30BBD678F530701867",18,void 0),s("CCL","Carnival","stock","0x9651342CeA770aE9a2969Ba2A52611523146aef9",18,void 0),s("COIN","Coinbase","stock","0x6330D8C3178a418788dF01a47479c0ce7CCF450b",18,"0xA3a468A452940B7D6b69991207B508c609a98Ef2"),s("COST","Costco","stock","0x4EA005168D7F09a7A0Ba9D1DEf21a479950E44C2",18,void 0),s("CRCL","Circle","stock","0xdF0992E440dD0be65BD8439b609d6D4366bf1CB5",18,"0x6652eDf64bA3731C4F2D3ce821A0Fb1f1f6b482a",{available:!1}),s("CRWV","CoreWeave","stock","0x5f10A1C971B69e47e059e1dC91901B59b3fB49C3",18,"0xe1b3aABCAFAd1c94708dc1367dcfF8Aa4407487C"),s("DELL","Dell","stock","0x941AE714EC6D8130c7B75d67160Ca08f1e7d11Dd",18,"0x1C6c8cADBe02E19129c39dDB92281cE4c0bf206b"),s("DJT","Trump Media","stock","0x1D11f0496982706C5e14A514D4E79F2e6BdE4516",18,void 0),s("F","Ford Motor","stock","0x25C288E6D899b9BC30160965aD9644c67e73bE0C",18,void 0,{isNew:!0}),s("FIG","Figma","stock","0x41F4267525a8AFf329540eF24fD83d9044758B33",18,void 0),s("GME","GameStop","stock","0x1b0E319c6A659F002271B69dB8A7df2F911c153E",18,"0x27C71df6A64fB476468EdF256CF72c038baB5B67"),s("GOOGL","Alphabet","stock","0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3",18,"0xF6f373a037c30F0e5010d854385cA89185AE638b"),s("HIMS","Hims & Hers","stock","0xCceE82fE024c36fA15E1005edE3E9e4787e23D09",18,void 0),s("IBM","IBM","stock","0x980dcf6766FA79f5Cf0c4AAdb3ab477ff15a9619",18,void 0),s("INTC","Intel","stock","0xc72b96e0E48ecd4DC75E1e45396e26300BC39681",18,"0x3f390C5C24628Ac7C489515402235FeAD71D1913"),s("JNJ","Johnson & Johnson","stock","0x03DfbBE0AC4E7bCDaFd08eD41A400326B77D8c80",18,void 0,{isNew:!0}),s("LLY","Eli Lilly","stock","0x8005d266423c7ea827372c9c864491e5786600ea",18,void 0),s("LMT","Lockheed Martin","stock","0x329fcACEb9AD6F9580DD5F643fed0646900D043c",18,void 0,{isNew:!0}),s("LULU","Lululemon","stock","0x4e62068525Ab11FE768e29dfD00ef909B9803016",18,void 0),s("META","Meta","stock","0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35",18,"0x7C38C00C30BEe9378381E7B6135d7283356D71b1"),s("MRNA","Moderna","stock","0x43B07D15cE533bEc5476d70C22a78a1B2B662155",18,void 0),s("MSFT","Microsoft","stock","0xe93237C50D904957Cf27E7B1133b510C669c2e74",18,"0x45C3C877C15E6BA2EBB19eA114Ea508d14C1Af2E"),s("MSTR","Strategy","stock","0xec262a75e413fAfD0dF80480274532C79D42da09",18,"0x396118bdFB181e6240E74D243F266B061c0edc3D"),s("MU","Micron","stock","0xfF080c8ce2E5feadaCa0Da81314Ae59D232d4afD",18,"0x425EEFdCf05ed6526C3cE61Af99429A228a6d596"),s("NBIS","Nebius Group","stock","0x9D9c6684F596F66a64C030B93A886D51Fd4D7931",18,void 0,{isNew:!0}),s("NET","Cloudflare","stock","0x116F00968269B7bfbaD4109cE591d6E74c0601d4",18,void 0),s("NFLX","Netflix","stock","0xE0444EF8BF4eD74f74FD73686e2ddF4C1c5591E8",18,void 0),s("NU","Nu Holdings","stock","0x408c14038a04f7bD235329E26d2bf569ee20e250",18,void 0),s("NVDA","NVIDIA","stock","0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC",18,"0x379EC4f7C378F34a1B47E4F3cbeBCbAC3E8E9F15"),s("ORCL","Oracle","stock","0xb0992820E760d836549ba69BC7598b4af75dEE03",18,"0x0e6a64a2B58A6693a531E6c555f3A5d042eEA844"),s("PFE","Pfizer","stock","0x7066A64c24e4206CD62E83bf198c1E7EB361F51e",18,void 0,{isNew:!0}),s("PLTR","Palantir","stock","0x894E1EC2D74FFE5AEF8Dc8A9e84686acCB964F2A",18,"0x820ABedFF239034956B7A9d2F0a331f9F075eB4c"),s("QUBT","Quantum Computing","stock","0x59818904ab4cE163b3cE4FfB64f2D6Ca02c434B4",18,void 0),s("RBLX","Roblox","stock","0xF0C4BF4C582cb3836e98394b1d4e7B7281101bE8",18,void 0),s("RDDT","Reddit","stock","0x05b37Fb53A299a1b874A619e1c4C404D52C36F4C",18,void 0),s("RIVN","Rivian","stock","0xB1BF26c1D20ff267A4f93550d1E0d06ac40a114B",18,void 0,{isNew:!0}),s("SHOP","Shopify","stock","0xF53F66751B1Eff985311b693531E3290F600c410",18,void 0,{isNew:!0}),s("SKHY","SK hynix","stock","0x84CAb63bc87912E71ad199ff14A0bA45de68FeF8",18,void 0),s("SNAP","Snap","stock","0xF6589F11Bc40b669e584073F428B05562F568733",18,void 0),s("SNDK","SanDisk","stock","0xB90A19fF0Af67f7779afF50A882A9CfF42446400",18,"0xfb133Fa4B7b385802B693a293606682Df47109A3"),s("SNOW","Snowflake","stock","0xBa0CAB75495255d0cB58E22B648bFED4ECD1F47E",18,void 0,{isNew:!0}),s("SOFI","SoFi Technologies","stock","0x98E75885157C80992A8D41b696D8c9C6Fb30A926",18,void 0),s("SPCX","SpaceX","stock","0x4a0E65A3EcceC6dBe60AE065F2e7bb85Fae35eEa",18,"0xB265810950ba6c5C0Ff821c9963014a56fD8Bffb"),s("TSLA","Tesla","stock","0x322F0929c4625eD5bAd873c95208D54E1c003b2d",18,"0x4A1166a659A55625345e9515b32adECea5547C38"),s("TSM","Taiwan Semiconductor","stock","0x58FfE4a942d3885bAa22D7520691F611EF09e7AA",18,"0x874cF94aa8eC88Fd9560094dD065f2fB3E41Fc2F"),s("TTWO","Take-Two Interactive","stock","0x5e81213613b6B86EaB4c6c50d718d34359459786",18,void 0),s("UPS","UPS","stock","0xf23250dac154D05Bb671CB0d0eBEf3c635c79CE2",18,void 0),s("USAR","USA Rare Earth","stock","0xd917B029C761D264c6A312BBbcDA868658eF86a6",18,"0xA994d3684e8400A6c8078226925779FdeE682DD9"),s("GLD","SPDR Gold Shares","etf","0xC9a981FEE1F9DEc688bb123ccDeCc63D0deBFC4e",18,void 0),s("QQQ","Invesco QQQ","etf","0xD5f3879160bc7c32ebb4dC785F8a4F505888de68",18,"0x80901d846d5D7B030F26B480776EE3b29374C2ae"),s("SGOV","iShares 0-3 Month Treasury Bond ETF","etf","0x92FD66527192E3e61d4DDd13322Aa222DE86F9B5",18,"0xa0DF4ee0fFf975306345875E3548Fcc519577A11"),s("SLV","iShares Silver Trust","etf","0x411eFb0E7f985935DAec3D4C3ebaEa0d0AD7D89f",18,"0x209b73908e92Ae021826eD79609845451Ecba2ce"),s("SPY","SPDR S&P 500 ETF","etf","0x117cc2133c37B721F49dE2A7a74833232B3B4C0C",18,"0x319724394D3A0e3669269846abE664Cd621f9f6A"),s("USO","United States Oil Fund","etf","0xa30FA36Db767ad9eD3f7a60fC79526fB4d56D344",18,void 0),s("XLK","Technology Select Sector SPDR ETF","etf","0x15Cd20759CE7F3285c29A319dE2D1A2e098c6f43",18,void 0)],c=i.filter(e=>!1!==e.available),n=new Map(i.map(e=>[e.address.toLowerCase(),e])),l=i.find(e=>"AI"===e.symbol);if(!l)throw Error("The AI entry is missing from ROBINHOOD_ASSETS");let f=l.address.toLowerCase(),d=i.find(e=>"NVDAx3L"===e.symbol);if(!d)throw Error("The NVDAx3L entry is missing from ROBINHOOD_ASSETS");let u=d.address.toLowerCase(),E=[{id:"new",label:"New",symbols:["SHOP","F","SNOW","RIVN","PFE","NBIS","LMT","JNJ"],description:"The latest markets listed on Robinhood Chain."},{id:"visionaries",label:"Visionaries",symbols:["TSLA","SPCX","PLTR"],description:"Founder-led companies chasing outsized futures."},{id:"big-tech",label:"Big Tech",symbols:["AAPL","AMZN","MSFT","META","GOOGL"],description:"The five largest listed technology companies."},{id:"software",label:"Software & Cloud",symbols:["NET","IBM","BB","FIG"],overlaySymbols:["SHOP","SNOW"],description:"Enterprise software, cloud, data and commerce platforms."},{id:"hardware",label:"Hardware",symbols:["NVDA","ORCL","SNDK","MU","AMD","INTC","CRWV","DELL","TSM","ASML","SKHY","QUBT"],overlaySymbols:["NBIS"],description:"Chips, servers and the compute supply chain."},{id:"media",label:"Media & Gaming",symbols:["NFLX","RBLX","RDDT","TTWO","DJT","AMC","SNAP"],description:"Streaming, gaming and social platforms."},{id:"consumer",label:"Consumer",symbols:["COST","GME","CCL","UPS","LULU"],description:"Household names from retail to logistics."},{id:"finance",label:"Finance",symbols:["COIN","CRCL","SOFI","NU","MSTR"],description:"Exchanges, fintech and crypto-treasury firms."},{id:"healthcare",label:"Healthcare",symbols:["MRNA","HIMS","LLY"],overlaySymbols:["PFE","JNJ"],description:"Biotech, pharma and consumer health."},{id:"autos",label:"Autos & EV",symbols:["F","RIVN","TSLA"],overlay:!0,description:"Carmakers from Detroit to the EV upstarts."},{id:"aerospace",label:"Aerospace & Defense",symbols:["BA"],overlaySymbols:["LMT","SPCX"],description:"Flight, launch and defense manufacturers."},{id:"commodities",label:"Commodities",symbols:["BE","USAR","USO","SLV"],description:"Oil, silver, energy and rare-earth materials."},{id:"etfs",label:"ETFs",symbols:["SPY","QQQ","GLD","SGOV","XLK"],description:"Broad-market, sector and asset-backed index funds."}],p=new Map(i.map(e=>[e.symbol,e])),A=E.map(({id:e,label:t,description:a,symbols:o,overlaySymbols:r})=>({id:e,label:t,description:a,assets:[...o,...r??[]].map(t=>{let a=p.get(t);if(!a)throw Error(`Stock category "${e}" references unknown symbol ${t}`);return a}).filter(e=>!1!==e.available)})).filter(e=>e.assets.length>0),v=["AI","NVDA","AAPL","AMZN","GOOGL","META","SPCX","TSLA"].map(e=>{let t=p.get(e);if(!t)throw Error(`Most-liquid rail references unknown symbol ${e}`);return t}).filter(e=>!1!==e.available),m=["AI","NVDA","TSLA","AAPL","SPY","AMZN"].map(e=>{let t=p.get(e);if(!t)throw Error(`Quick-pick rail references unknown symbol ${e}`);return t}).filter(e=>!1!==e.available),b=E.filter(e=>!e.overlay).flatMap(e=>e.symbols);if(new Set(b).size!==b.length)throw Error("A symbol appears in more than one stock category");for(let e of c)if(("stock"===e.kind||"etf"===e.kind)&&!b.includes(e.symbol))throw Error(`Launchable asset ${e.symbol} is missing from every stock category`);e.s(["ROBINHOOD_AI_ADDRESS",0,f,"ROBINHOOD_ASSETS",0,i,"ROBINHOOD_ASSET_BY_ADDRESS",0,n,"ROBINHOOD_LAUNCHABLE_ASSETS",0,c,"ROBINHOOD_MOST_LIQUID_ASSETS",0,v,"ROBINHOOD_NVDA3X_ADDRESS",0,u,"ROBINHOOD_QUICK_PICK_ASSETS",0,m,"ROBINHOOD_STOCK_CATEGORIES",0,A,"isAiNumeraire",0,e=>e?.toLowerCase()===f,"isNvda3xNumeraire",0,e=>e?.toLowerCase()===u])},460880,e=>{"use strict";let t=new Set(["aapl","ai","amc","amd","amzn","asml","ba","baba","bb","be","ccl","coin","cost","crcl","crwv","dell","djt","f","fig","gld","gme","googl","hims","ibm","intc","jnj","lly","lmt","lulu","meta","mrna","msft","mstr","mu","nbis","net","nflx","nu","nvda","orcl","pfe","pltr","qqq","qubt","rblx","rddt","rivn","sgov","shop","skhy","slv","snap","sndk","snow","sofi","spcx","spy","tsla","tsm","ttwo","ups","usar","uso","xlk"]);e.s(["stockCoinSrc",0,e=>{if(!e)return null;let a=e.toLowerCase();return t.has(a)?`/robinhood-coins/${a}.png`:"eth"===a?"/Ethereum-icon-purple.svg":"usdg"===a?"/usdg.svg":null}])},513835,e=>{"use strict";e.i(330891);var t=e.i(385390),a=e.i(477707),o=e.i(185121),r=e.i(741019),s=e.i(111064),i=e.i(113353),c=e.i(664604),n=a,l=e.i(978316);function f(e,t){if("function"==typeof e)return e(t);null!=e&&(e.current=t)}class d extends n.Component{getSnapshotBeforeUpdate(e){let t=this.props.childRef.current;if(t&&e.isPresent&&!this.props.isPresent&&!1!==this.props.pop){let e=t.offsetParent,a=(0,c.isHTMLElement)(e)&&e.offsetWidth||0,o=(0,c.isHTMLElement)(e)&&e.offsetHeight||0,r=this.props.sizeRef.current;r.height=t.offsetHeight||0,r.width=t.offsetWidth||0,r.top=t.offsetTop,r.left=t.offsetLeft,r.right=a-r.width-r.left,r.bottom=o-r.height-r.top}return null}componentDidUpdate(){}render(){return this.props.children}}function u({children:e,isPresent:o,anchorX:r,anchorY:s,root:i,pop:c}){let u=(0,n.useId)(),E=(0,n.useRef)(null),p=(0,n.useRef)({width:0,height:0,top:0,left:0,right:0,bottom:0}),{nonce:A}=(0,n.useContext)(l.MotionConfigContext),v=function(...e){return a.useCallback(function(...e){return t=>{let a=!1,o=e.map(e=>{let o=f(e,t);return a||"function"!=typeof o||(a=!0),o});if(a)return()=>{for(let t=0;t<o.length;t++){let a=o[t];"function"==typeof a?a():f(e[t],null)}}}}(...e),e)}(E,e.props?.ref??e?.ref);return(0,n.useInsertionEffect)(()=>{let{width:e,height:t,top:a,left:n,right:l,bottom:f}=p.current;if(o||!1===c||!E.current||!e||!t)return;let d="left"===r?`left: ${n}`:`right: ${l}`,v="bottom"===s?`bottom: ${f}`:`top: ${a}`;E.current.dataset.motionPopId=u;let m=document.createElement("style");A&&(m.nonce=A);let b=i??document.head;return b.appendChild(m),m.sheet&&m.sheet.insertRule(`
          [data-motion-pop-id="${u}"] {
            position: absolute !important;
            width: ${e}px !important;
            height: ${t}px !important;
            ${d}px !important;
            ${v}px !important;
          }
        `),()=>{b.contains(m)&&b.removeChild(m)}},[o]),(0,t.jsx)(d,{isPresent:o,childRef:E,sizeRef:p,pop:c,children:!1===c?e:n.cloneElement(e,{ref:v})})}let E=({children:e,initial:o,isPresent:s,onExitComplete:c,custom:n,presenceAffectsLayout:l,mode:f,anchorX:d,anchorY:E,root:A})=>{let v=(0,r.useConstant)(p),m=(0,a.useId)(),b=!0,C=(0,a.useMemo)(()=>(b=!1,{id:m,initial:o,isPresent:s,custom:n,onExitComplete:e=>{for(let t of(v.set(e,!0),v.values()))if(!t)return;c&&c()},register:e=>(v.set(e,!1),()=>v.delete(e))}),[s,v,c]);return l&&b&&(C={...C}),(0,a.useMemo)(()=>{v.forEach((e,t)=>v.set(t,!1))},[s]),a.useEffect(()=>{s||v.size||!c||c()},[s]),e=(0,t.jsx)(u,{pop:"popLayout"===f,isPresent:s,anchorX:d,anchorY:E,root:A,children:e}),(0,t.jsx)(i.PresenceContext.Provider,{value:C,children:e})};function p(){return new Map}var A=e.i(72875);let v=e=>e.key||"";function m(e){let t=[];return a.Children.forEach(e,e=>{(0,a.isValidElement)(e)&&t.push(e)}),t}let b=({children:e,custom:i,initial:c=!0,onExitComplete:n,presenceAffectsLayout:l=!0,mode:f="sync",propagate:d=!1,anchorX:u="left",anchorY:p="top",root:b})=>{let[C,D]=(0,A.usePresence)(d),h=(0,a.useMemo)(()=>m(e),[e]),x=d&&!C?[]:h.map(v),S=(0,a.useRef)(!0),B=(0,a.useRef)(h),g=(0,r.useConstant)(()=>new Map),y=(0,a.useRef)(new Set),[F,N]=(0,a.useState)(h),[k,T]=(0,a.useState)(h);(0,s.useIsomorphicLayoutEffect)(()=>{S.current=!1,B.current=h;for(let e=0;e<k.length;e++){let t=v(k[e]);x.includes(t)?(g.delete(t),y.current.delete(t)):!0!==g.get(t)&&g.set(t,!1)}},[k,x.length,x.join("-")]);let L=[];if(h!==F){let e=[...h];for(let t=0;t<k.length;t++){let a=k[t],o=v(a);x.includes(o)||(e.splice(t,0,a),L.push(a))}return"wait"===f&&L.length&&(e=L),T(m(e)),N(h),null}let{forceRender:O}=(0,a.useContext)(o.LayoutGroupContext);return(0,t.jsx)(t.Fragment,{children:k.map(e=>{let a=v(e),o=(!d||!!C)&&(h===k||x.includes(a));return(0,t.jsx)(E,{isPresent:o,initial:(!S.current||!!c)&&void 0,custom:i,presenceAffectsLayout:l,mode:f,root:b,onExitComplete:o?void 0:()=>{if(y.current.has(a)||(y.current.add(a),!g.has(a)))return;g.set(a,!0);let e=!0;g.forEach(t=>{t||(e=!1)}),e&&(O?.(),T(B.current),d&&D?.(),n&&n())},anchorX:u,anchorY:p,children:e},a)})})};e.s(["AnimatePresence",()=>b],513835)},261419,e=>{"use strict";var t=e.i(108094),a=e.i(481503),o=e.i(477707);function r(){t.hasReducedMotionListener.current||(0,a.initPrefersReducedMotion)();let[e]=(0,o.useState)(t.prefersReducedMotion.current);return e}e.s(["useReducedMotion",()=>r])},202551,e=>{"use strict";var t=e.i(542940),a=e.i(886247),o=e.i(383035);function r(e){let o=e.counterToken?.address??a.zeroAddress,r="buy"===e.direction?e.counterToken?.decimals??18:e.tokenDecimals??18;return{chainId:e.chainId,tokenIn:"buy"===e.direction?o:e.token,tokenOut:"buy"===e.direction?e.token:o,amount:(0,t.parseUnits)(e.amount,r).toString(),user:e.user,slippageBps:Math.round(100*e.slippagePercent)}}class s extends Error{status;rawError;constructor(e,t,a){super(e),this.name="BestQuoteError",void 0!==t&&(this.status=t),void 0!==a&&(this.rawError=a)}}let i=`${o.LONG_API_URL.replace(/\/$/,"")}/swap-quote/best`;async function c(e){let t;try{t=await fetch(i,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(e)})}catch{throw new s("Could not reach the quote service")}if(!t.ok){var a;let e,o=await t.json().catch(()=>void 0);throw a=t.status,e=o&&"object"==typeof o?o:void 0,new s("string"==typeof e?.message&&e.message||"string"==typeof e?.error&&e.error||"No swap quote is currently available",a,e)}return await t.json()}e.s(["buildBestQuoteRequest",()=>r,"fetchBestQuote",()=>c])}]);

//# debugId=0fe2f737-1b4b-f94c-47a5-6bfc09bf28a8
//# sourceMappingURL=49f6bb77afc09a18.js.map