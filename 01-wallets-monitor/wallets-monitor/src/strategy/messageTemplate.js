import { formatTimeAgo } from '../utils/txsAnalyzer.js';

// Formats a number to a readable currency string with appropriate suffixes
function formatNumber(number) {
  // Ensure number is a numeric type
  const num = Number(number);
  
  // Check if it's a valid number
  if (isNaN(num)) {
    return '$0.00';
  }
  if (num >= 1_000_000) {
    return `$${(num / 1_000_000).toFixed(1)}M`;
  } else if (num >= 1_000) {
    return `$${Math.round(num / 1_000)}K`;
  }
  return `$${Math.round(num)}`;
}

// 消息模板接口
class MessageTemplate {
  createMessage(tokenInfo, analysis) {
    throw new Error('Method not implemented');
  }
}

// Telegram消息模板
class TelegramMessageTemplate extends MessageTemplate {
  // Formats smart money wallet data into a readable string for Telegram
  formatSmartMoney(analysis) {
    let details = '';
    for (const [address, data] of Object.entries(analysis)) {
      details += `\u{25AB}<a href="https://solscan.io/account/${address}">${data.walletName}</a> bought ${formatNumber(data.totalBuyCost)} at MC ${formatNumber(data.averageMarketCap)}(${data.buyTime}), Holds: ${data.holdsPercentage}\n`;
    }
    return details.trim();
  }

  createMessage(tokenInfo, analysis) {
    const smartMoneyCount = Object.keys(analysis).length;
    
    return `
\u{1F436} Multi Buy Token: <b>$${tokenInfo.symbol}</b>
<code>${tokenInfo.address}</code>

\u{1F90D} <b>Solana</b>
\u{1F49B} <b>MC:</b> <code>${formatNumber(tokenInfo.marketCap)}</code>
\u{1F90E} <b>Vol/24h:</b> <code>${formatNumber(tokenInfo.volumeH24)}</code>
\u{1F90D} <b>Vol/1h:</b> <code>${formatNumber(tokenInfo.volumeH1)}</code>
\u{1F49B} <b>Liq:</b> <code>${formatNumber(tokenInfo.liquidity)}</code>
\u{1F90E} <b>USD:</b> <code>$${Number(tokenInfo.priceUSD).toFixed(6)}</code>
\u{1F90D} <b>Age:</b> <code>${formatTimeAgo(tokenInfo.createdAt)}</code>
\u{1F49B} <b>6H:</b> <code>${tokenInfo.changeH6}%</code>
\u{1F90E} <b>SmartMoney:</b>
${smartMoneyCount} wallets bought $${tokenInfo.symbol}

${this.formatSmartMoney(analysis)}

<a href="https://dexscreener.com/solana/${tokenInfo.address}">DexScreener</a> | <a href="https://gmgn.ai/sol/token/${tokenInfo.address}">GMGN</a>${tokenInfo.website ? ` | <a href="${tokenInfo.website}">Website</a>` : ''}${tokenInfo.twitter ? ` | <a href="${tokenInfo.twitter}">Twitter</a>` : ''}
`.trim();
  }
}

// 飞书消息模板
class FeishuMessageTemplate extends MessageTemplate {
  // 格式化智能钱包数据为飞书可读格式
  formatSmartMoney(analysis) {
    let details = '';
    for (const [address, data] of Object.entries(analysis)) {
      // 飞书不支持HTML标签，使用纯文本
      details += `- ${address}:${data.walletName} 买入 ${formatNumber(data.totalBuyCost)} 市值 ${formatNumber(data.averageMarketCap)}(${data.buyTime}), 持有: ${data.holdsPercentage}\n`;
    }
    return details.trim();
  }

  createMessage(tokenInfo, analysis) {
    const smartMoneyCount = Object.keys(analysis).length;
    
    return `
🐶 多钱包买入代币: $${tokenInfo.symbol}
${tokenInfo.address}

💝 Solana
💛 市值: ${formatNumber(tokenInfo.marketCap)}
💞 24小时交易量: ${formatNumber(tokenInfo.volumeH24)}
💝 1小时交易量: ${formatNumber(tokenInfo.volumeH1)}
💛 流动性: ${formatNumber(tokenInfo.liquidity)}
💞 价格: $${Number(tokenInfo.priceUSD).toFixed(6)}
💝 上线时间: ${formatTimeAgo(tokenInfo.createdAt)}
💛 6小时涨幅: ${tokenInfo.changeH6}%
💞 智能钱包:
${smartMoneyCount} 个钱包买入 $${tokenInfo.symbol}

${this.formatSmartMoney(analysis)}

链接:
- DexScreener: https://dexscreener.com/solana/${tokenInfo.address}
- GMGN: https://gmgn.ai/sol/token/${tokenInfo.address}${tokenInfo.website ? `\n- 网站: ${tokenInfo.website}` : ''}${tokenInfo.twitter ? `\n- Twitter: ${tokenInfo.twitter}` : ''}
`.trim();
  }
}

// 消息模板工厂
class MessageTemplateFactory {
  static getTemplate(platform) {
    if (platform === 'telegram') {
      return new TelegramMessageTemplate();
    } else if (platform === 'feishu') {
      return new FeishuMessageTemplate();
    }
    // 默认使用Telegram模板
    return new TelegramMessageTemplate();
  }
}

// 为向后兼容保留原始函数
export function formatSmartMoney(analysis) {
  return MessageTemplateFactory.getTemplate('telegram').formatSmartMoney(analysis);
}

// 创建特定平台的消息
export function createMsg(tokenInfo, analysis, platform = 'telegram') {
  const template = MessageTemplateFactory.getTemplate(platform);
  return template.createMessage(tokenInfo, analysis);
}

