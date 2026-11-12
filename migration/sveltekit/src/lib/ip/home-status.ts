import services from '../../routes/status/services.json';

const featuredIds = ['9', '4', '10', '5', '0', '19', '15', '1'];
export const featuredServices = featuredIds.map(id => {
  const service = services.find(item => item.id === id);
  if (!service) throw new Error(`Missing featured service: ${id}`);
  return service;
});

export const featuredPlatforms = [
  { name: 'ChatGPT', domain: 'chatgpt.com' }, { name: 'Gemini', domain: 'gemini.google.com' },
  { name: 'Claude', domain: 'claude.ai' }, { name: 'DeepSeek', domain: 'chat.deepseek.com' },
  { name: 'Grok', domain: 'grok.com' }, { name: 'Perplexity', domain: 'www.perplexity.ai' },
  { name: 'Qwen', domain: 'chat.qwen.ai' }, { name: 'Kimi', domain: 'www.kimi.com' }
];
