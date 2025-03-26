import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

// 发送飞书群消息，支持回复功能
export async function sendFeishuMessage(message, replyToMessageId = null) {
    const webhookUrl = process.env.FEISHU_WEBHOOK_URL;

    if (!webhookUrl) {
        throw new Error('FEISHU_WEBHOOK_URL not found in environment variables');
    }

    try {
        // 构建飞书消息格式
        const messageBody = {
            msg_type: "text",
            content: {
                text: message
            }
        };

        // 如果有 replyToMessageId，添加回复信息
        if (replyToMessageId) {
            messageBody.content.root_id = replyToMessageId;
        }

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(messageBody),
        });

        const data = await response.json();
        console.log(data);

        if (data.code !== 0) {
            throw new Error(`Feishu API error: ${data.msg || 'Unknown error'}`);
        }

        return data;
    } catch (error) {
        console.error('Error sending Feishu message:', error);
        throw error;
    }
}