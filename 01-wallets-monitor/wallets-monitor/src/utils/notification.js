import dotenv from 'dotenv';
import { sendTelegramMessage } from './telegram.js';
import { sendFeishuMessage } from './feishu.js';
import { createMsg } from '../strategy/messageTemplate.js';

dotenv.config();

// 通知器接口（抽象类）
class NotificationSender {
  constructor(platform) {
    this.platform = platform;
  }
  
  // 格式化消息并发送
  async formatAndSend(tokenInfo, analysis, replyToMessageId = null) {
    const message = createMsg(tokenInfo, analysis, this.platform);
    return await this.send(message, replyToMessageId);
  }
  
  async send(message, replyToMessageId = null) {
    throw new Error('Method not implemented');
  }
}

// Telegram通知器实现
class TelegramSender extends NotificationSender {
  constructor() {
    super('telegram');
  }
  
  async send(message, replyToMessageId = null) {
    return await sendTelegramMessage(message, replyToMessageId);
  }
}

// 飞书通知器实现
class FeishuSender extends NotificationSender {
  constructor() {
    super('feishu');
  }
  
  async send(message, replyToMessageId = null) {
    return await sendFeishuMessage(message, replyToMessageId);
  }
}

// 通知工厂类
class NotificationFactory {
  static getSenders() {
    const enabledChannels = (process.env.NOTIFICATION_CHANNELS || 'telegram').split(',').map(c => c.trim().toLowerCase());
    const senders = [];
    
    if (enabledChannels.includes('telegram') && process.env.TELEGRAM_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      senders.push(new TelegramSender());
    }
    
    if (enabledChannels.includes('feishu') && process.env.FEISHU_WEBHOOK_URL) {
      senders.push(new FeishuSender());
    }
    
    return senders;
  }
  
  // 获取特定平台的发送器
  static getSender(platform) {
    if (platform === 'telegram' && process.env.TELEGRAM_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      return new TelegramSender();
    } else if (platform === 'feishu' && process.env.FEISHU_WEBHOOK_URL) {
      return new FeishuSender();
    }
    return null;
  }
}

// 统一发送通知的方法 - 使用原始字符串消息
export async function sendNotification(message, replyToMessageId = null) {
  const senders = NotificationFactory.getSenders();
  
  if (senders.length === 0) {
    console.warn('No notification channels configured or enabled');
    return null;
  }
  
  const results = [];
  
  for (const sender of senders) {
    try {
      const result = await sender.send(message, replyToMessageId);
      results.push(result);
    } catch (error) {
      console.error(`Error sending ${sender.platform} notification:`, error);
    }
  }
  
  // 返回第一个成功的结果，通常用于获取消息ID等数据
  return results.length > 0 ? results[0] : null;
}

// 发送到指定平台的通知方法
export async function sendPlatformNotification(message, platform, replyToMessageId = null) {
  const sender = NotificationFactory.getSender(platform);
  
  if (!sender) {
    console.warn(`Platform ${platform} not configured or enabled`);
    return null;
  }
  
  try {
    return await sender.send(message, replyToMessageId);
  } catch (error) {
    console.error(`Error sending ${platform} notification:`, error);
    return null;
  }
}

// 新增方法：将分析数据格式化为特定平台的消息并发送
export async function sendFormattedNotification(tokenInfo, analysis) {
  const senders = NotificationFactory.getSenders();
  
  if (senders.length === 0) {
    console.warn('No notification channels configured or enabled');
    return null;
  }
  
  const results = [];
  
  for (const sender of senders) {
    try {
      const result = await sender.formatAndSend(tokenInfo, analysis);
      results.push(result);
    } catch (error) {
      console.error(`Error sending ${sender.platform} notification:`, error);
    }
  }
  
  return results.length > 0 ? results[0] : null;
}

// 新增方法：将分析数据格式化为特定平台的消息并发送，但返回按平台分组的结果
export async function sendFormattedNotificationByPlatform(tokenInfo, analysis) {
  const senders = NotificationFactory.getSenders();
  
  if (senders.length === 0) {
    console.warn('No notification channels configured or enabled');
    return {};
  }
  
  const resultsByPlatform = {};
  
  for (const sender of senders) {
    try {
      const result = await sender.formatAndSend(tokenInfo, analysis);
      resultsByPlatform[sender.platform] = result;
    } catch (error) {
      console.error(`Error sending ${sender.platform} notification:`, error);
      resultsByPlatform[sender.platform] = null;
    }
  }
  
  return resultsByPlatform;
}
