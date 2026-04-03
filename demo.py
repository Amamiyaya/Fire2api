# -*- coding: UTF-8 -*-
# @Project : keyan 
# @File    : demo.py
# @Author  : Amamiya Sora's Sweet Dog
# @Date    : 2026/4/3 16:15 
# @Software: PyCharm
import requests

headers = {
    'accept': 'text/event-stream',
    'accept-language': 'zh-CN,zh;q=0.9',
    'authorization': 'Bearer internal_KZkurTUv4ycYBpcfLMhhLy',
    'cache-control': 'no-cache',
    'content-type': 'application/json',
    'fireworks-playground': 'true',
    'origin': 'https://app.fireworks.ai',
    'pragma': 'no-cache',
    'priority': 'u=1, i',
    'sec-ch-ua': '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-site',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
}

json_data = {
    'temperature': 0.6,
    'top_p': 1,
    'n': 1,
    'logprobs': True,
    'stream': True,
    'echo': False,
    'model': 'accounts/fireworks/models/glm-5',
    'max_tokens': 4096,
    'top_k': 40,
    'presence_penalty': 0,
    'frequency_penalty': 0,
    'messages': [
        {
            'role': 'user',
            'content': '你是谁？',
        },
    ],
}

response = requests.post('https://127.0.0.1:3001/v1/chat/completions', headers=headers, json=json_data)
print(response.text)
