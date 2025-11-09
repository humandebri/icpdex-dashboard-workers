// 取引所アカウント定義: どのウォレットをどの価格ソースに対応付けるかを一元管理
export const LEDGER_CANISTER_ID = 'ryjl3-tyaaa-aaaaa-aaaba-cai';

export const EXCHANGE_ACCOUNTS = [
  { name: 'Bitget', accountHex: 'bad030b417484232fd2019cb89096feea3fdd3d9eb39e1d07bcb9a13c7673464', priceSource: null },
  { name: 'Binance coldwallet', accountHex: '609d3e1e45103a82adc97d4f88c51f78dedb25701e8e51e8c4fec53448aadc29', priceSource: 'binance' },
  { name: 'Binance hotwallet', accountHex: '220c3a33f90601896e26f76fa619fe288742df1fa75426edfaf759d39f2455a5', priceSource: 'binance' },
  { name: 'Bybit', accountHex: 'acd76fff0536f863d9dd4b326a1435466f82305758b4b1b4f62ff9fa81c14073', priceSource: 'bybit' },
  { name: 'Coinbase 1', accountHex: '449ce7ad1298e2ed2781ed379aba25efc2748d14c60ede190ad7621724b9e8b2', priceSource: 'coinbase' },
  { name: 'Coinbase 2', accountHex: '4dfa940def17f1427ae47378c440f10185867677109a02bc8374fc25b9dee8af', priceSource: 'coinbase' },
  { name: 'Coinbase 3', accountHex: 'dd15f3040edab88d2e277f9d2fa5cc11616ebf1442279092e37924ab7cce8a74', priceSource: 'coinbase' },
  { name: 'Gate.io', accountHex: '8fe706db7b08f957a15199e07761039a7718937aabcc0fe48bc380a4daf9afb0', priceSource: null },
  { name: 'HTX', accountHex: '935b1a3adc28fd68cacc95afcdec62e985244ce0cfbbb12cdc7d0b8d198b416d', priceSource: null },
  { name: 'Kraken', accountHex: '040834c30cdf5d7a13aae8b57d94ae2d07eefe2bc3edd8cf88298730857ac2eb', priceSource: null },
  { name: 'KuCoin 1', accountHex: 'efa01544f509c56dd85449edf2381244a48fad1ede5183836229c00ab00d52df', priceSource: null },
  { name: 'KuCoin 2', accountHex: '00c3df112e62ad353b7cc7bf8ad8ce2fec8f5e633f1733834bf71e40b250c685', priceSource: null },
  { name: 'MEXC', accountHex: '9e62737aab36f0baffc1faac9edd92a99279723eb3feb2e916fa99bb7fe54b59', priceSource: null },
  { name: 'OKX 1', accountHex: 'e7a879ea563d273c46dd28c1584eaa132fad6f3e316615b3eb657d067f3519b5', priceSource: null },
  { name: 'OKX 2', accountHex: 'd2c6135510eaf107bdc2128ef5962c7db2ae840efdf95b9395cdaf4983942978', priceSource: null },
];
