import { searchTwitter, getUserTimeline } from './tweetApi.js';
import { sendNotification, sendPlatformNotification } from './notification.js';
import OpenAI from "openai";
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com/v1",
});

// Summarizes tweets related to a token from both account and search results
async function sumTweets(tokenInfo) {
  const { symbol, address, twitter } = tokenInfo;
  
  let account_tweets = [];
  let search_tweets = [];
  
  // Get tweets from Twitter account
  if (twitter && (twitter.includes('x.com/') || twitter.includes('twitter.com/'))) {
    const urlParts = twitter.split('/');
    // Exclude special links
    if (!twitter.includes('/communities/') && !twitter.includes('/search?') && !twitter.includes('/status/')) {
      let screenname = urlParts[urlParts.length - 1].split('?')[0];
      
      const timelineResult = await getUserTimeline(screenname);
      if (timelineResult) account_tweets = timelineResult;
      else console.log('Failed to fetch user tweets:', screenname);
    }
  }
  
  // Search for tweets related to token address
  search_tweets = await searchTwitter(address);
  
  if (!search_tweets?.length) {
    console.log('No tweets found for address:', address);
    return `No tweet data found for ${symbol}(${address}).`;
  }
  
  // Analyze tweets
  const search_summary = await genSum(symbol, search_tweets, 'search');
  
  let account_summary = "";
  if (account_tweets?.tweets?.length > 0) {
    account_summary = await genSum(symbol, account_tweets, 'account');
  }
  
  if (!search_summary && !account_summary) {
    console.log(`Unable to generate tweet analysis summary for ${symbol}.`);
    return null;
  }
  
  return { search_summary, account_summary };
}

// Generates a summary of tweets using AI
async function genSum(symbol, tweets, type = 'search') {
  try {
    let tweetData = [];
    let promptPrefix = '';
    let promptSuffix = '';
    
    if (type === 'account') {
      promptPrefix = `请总结关于 ${symbol} 的账号推文:`;
      promptSuffix = `提供简短的要点总结。保持简洁直接,去除所有不必要的词语。`;
      
      // Process account tweets format
      tweetData = tweets.tweets.map((tweet, index) => `
Tweet ${index + 1}:
Content: ${tweet.text}
Time: ${tweet.created_at}
Engagement: ${tweet.views} views / ${tweet.favorites} likes 
---`);
    } else {
      // Search tweets
      promptPrefix = `请总结关于 ${symbol} 的搜索推文:`;
      promptSuffix = `提供关于叙事观点和风险内容的极简要点总结。不总结主观价格预测和个人收益的内容。保持简洁直接,去除所有不必要的词语。格式如下：
- 叙事观点：
- 风险内容：`;
      
      // Process search tweets format
      tweetData = tweets.map((tweet, index) => `
Tweet ${index + 1}:
Content: ${tweet.text}
Time: ${tweet.created_at}
Author: ${tweet.author.name} (@${tweet.author.screen_name})
Followers: ${tweet.author.followers_count}
Engagement: ${tweet.views} views / ${tweet.favorites} likes 
---`);
    }
    
    const prompt = `${promptPrefix}

${tweetData.join('\n')}

${promptSuffix}`;

    const response = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: "You are a helpful assistant that analyzes cryptocurrency Twitter data." },
        { role: "user", content: prompt }
      ],
      temperature: 1.0,
      max_tokens: 3000
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error("Error generating Twitter summary:", error);
    return "Failed to generate summary due to an error.";
  }
}


// 为不同平台格式化推特摘要消息
function formatSummaryMessage(tokenInfo, search_summary, account_summary, platform = 'telegram') {
  let message = '';

  if (platform === 'telegram') {
    message = `\u{1F49B}${tokenInfo.symbol} tweets summary:\n`;

    if (account_summary) {
      // Format line breaks and spaces, replace multiple line breaks with a single one
      const formattedAccountSummary = account_summary
        .replace(/\n\s*\n/g, '\n')
        .trim();
      message += `<blockquote>${formattedAccountSummary}</blockquote>\n\n`;
    }

    if (search_summary) {
      message += `\u{1F49B}Searched tweets summary:\n<blockquote>${search_summary}</blockquote>`;
    }
  } else if (platform === 'feishu') {
    message = `💛 ${tokenInfo.symbol} 推文摘要:\n`;

    if (account_summary) {
      // 处理飞书格式，不支持HTML标签
      const formattedAccountSummary = account_summary
        .replace(/\n\s*\n/g, '\n')
        .trim();
      message += `官方账号摘要:\n${formattedAccountSummary}\n\n`;
    }

    if (search_summary) {
      message += `💛 相关推文摘要:\n${search_summary}`;
    }
  }

  return message;
}

// 发送推特摘要到不同平台，作为各自平台上特定消息的回复
export async function sendSumMessageByPlatform(tokenInfo, platformResponses) {
  const summaryResult = await sumTweets(tokenInfo);
  if (!summaryResult) {
    console.log(`Unable to get tweet summary for ${tokenInfo.symbol}`);
    return {};
  }
  
  const { search_summary, account_summary } = summaryResult;
  const results = {};
  
  // 遍历每个平台的响应，为每个平台发送对应的摘要
  for (const [platform, response] of Object.entries(platformResponses)) {
    if (!response) continue;
    
    try {
      // 提取消息ID，根据不同平台的响应格式
      let messageId = null;
      if (platform === 'telegram' && response.result && response.result.message_id) {
        messageId = response.result.message_id;
      } else if (platform === 'feishu' && response.data && response.data.message_id) {
        messageId = response.data.message_id;
      }
      
      // 格式化该平台的消息
      const formattedMessage = formatSummaryMessage(tokenInfo, search_summary, account_summary, platform);
      
      // 发送到该特定平台
      const result = await sendPlatformNotification(formattedMessage, platform, messageId);
      if (result) {
        results[platform] = result;
        console.log(`Successfully sent ${tokenInfo.symbol} tweet summary to ${platform}`);
      }
    } catch (error) {
      console.error(`Error sending summary to ${platform}:`, error);
    }
  }
  
  return results;
}
