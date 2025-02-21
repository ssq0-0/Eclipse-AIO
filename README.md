# Eclipse AIO

## Overview

**Eclipse AIO** is a TypeScript-based project designed to automate interactions with blockchain applications, including decentralised exchanges (DEX) and nft protocols. It has a modular architecture to support multiple accounts, transaction management and interaction with apps.

---

## Features

- **Relay**. Bridge to Eclipse network. Bridge from arb, op, base, linea is available. USDT/USDC
- **Solar**. Dex protocol. Has multiple exchange routes.
- **Lifinity**. Dex protocol. Has several exchange routes.
- **Orca**. Dex protocol. Has multiple routes
- **Underdog**. Nft protocol. Self-generates picture, description and all necessary information. 
- **Collector**. Collector module. Need for swap all tokens in account to ETH.
---
## Installation
### Steps

1. Clone the repository:
```bash
git clone https://github.com/ssq0-0/Eclipse-AIO.git
cd Eclipse-AIO
npm i 
npm run build
```
2. Run the application:
- **Setup config.json(time and count actions)**

```bash
npm run start
```

### EVM Wallets (`evm_wallets.txt`)

Put EVM wallets here to use the Relay module. Otherwise it can be left empty. Note that the order is important for mapping to the sol_walles.txt file

### SVM Wallets (`sol_wallets.txt`)

Put SVM wallets here to use the Relay module. Otherwise it can be left empty. Note that the order is important for mapping to the evm_walles.txt file

---
### Proxy (`proxy.txt`)

This section defines the proxy used by the program. Each proxy is described by the following fields:

- **`http://user:pass@ip:port`**:
---
### Config (`user_config.json`)

Set up the configuration. 
Full configuration instructions can be found in the same file, with detailed comments on each parameter. Initially, the basic configuration with average values is also specified by default

**IMPORTANT!** token for Underdog module should be specified in dev_config.json file.

### Config (`dev_config.json`)
In this file, you can change the RPC of each network. Errors related to rpc are visually understandable, they do not look like usual errors related to balance and so on. 

**token**. For successful generation of photos, names and descriptions in Underdog module you need to register here: https://unsplash.com/join.

After registration you need to confirm your email. Then create an application here: https://unsplash.com/oauth/applications and get API token inside the application on this page: https://unsplash.com/oauth/applications/. You need to get the ‘Access Key’. 

### Config (`bridger_info.json`)
In this file you can write the configuration for the Realy module and the bridge to ECLIPSE, as well as for ECLIPSE and other chains (Linea, Arb, Op, Base).  

The key to the configuration is the address of the wallet from which the bridge will be made. It is also possible to select a certain amount for bridge in network6 or use a range6 which will be used randomly. It is also possible to specify the final token, or specify one token from which the exchange will be made. 

Example configuration (all addresses are made up and do not exist in reality).
 
```bash
{
    "SJPKjYxcdQ21PYwDr326n44VRyUjsrmuha8NLJ8xBq79":{
        "from":"eclipse",
        "to":"op",
        "wallet":"0x321F11d8f0f9B9558bebr0912FE4e39Dd46Af92d",
        "token":["eth", "usdt"],
        "range":[0.0059]
    },
    "UIJMqD3gXsZxUAK2xyGfdIoOkizvdy3XFQfEYrJa3zUU":{
        "from":"eclipse",
        "to":"arb",
        "wallet":"0x549e6Bf512754Df7C1E509367aFAb118fd15735C",
        "token":["eth"],
        "range":[0.0389, 0.1]
    }
}
```

**IMPORTANT!** 
```bash
["eth"] - use one token for FROM and destination currency
["eth", "usdt"] - use ETH for from chain and usdt destination currency

[0.05] - use fix amount
[0.05, 0.1] - use range amount
```

**IMPORTANT!** The bridge from and to ECLIPSE does not support any tokens other than ETH



### For additional assistance or troubleshooting, refer to the official documentation or reach out via [support channel](https://t.me/cheifssq).
