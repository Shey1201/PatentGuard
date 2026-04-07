import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Select, message, Alert, Space, Spin, Collapse, Tooltip } from 'antd';
import { ApiOutlined, CheckCircleOutlined, LoadingOutlined, SettingOutlined, RocketOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { systemApi } from '../services/api';

const { Panel } = Collapse;

const SettingsPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const { data } = await systemApi.getConfig();
      form.setFieldsValue({
        llm_model: data.llm_model || 'gpt-4o-mini',
        llm_api_key: data.llm_api_key || '',
        llm_base_url: data.llm_base_url || 'https://api.openai.com/v1',
        llm_provider: data.llm_provider || 'openai',
      });
    } catch (error) {
      console.warn('加载配置失败，使用默认配置');
      form.setFieldsValue({
        llm_model: 'gpt-4o-mini',
        llm_api_key: '',
        llm_base_url: 'https://api.openai.com/v1',
        llm_provider: 'openai',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (values: any) => {
    setSaving(true);
    try {
      await systemApi.updateLLMConfig({
        llm_provider: values.llm_provider,
        llm_model: values.llm_model,
        llm_api_key: values.llm_api_key,
        llm_base_url: values.llm_base_url,
      });
      message.success('配置保存成功');
    } catch (error) {
      message.error('保存配置失败');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const { data } = await systemApi.testLLM();
      if (data.success) {
        setTestResult({ success: true, message: `连接成功! 响应: ${data.response}` });
      } else {
        setTestResult({ success: false, message: `连接失败: ${data.error}` });
      }
    } catch (error: any) {
      setTestResult({ success: false, message: `测试失败: ${error?.message || '网络错误'}` });
    } finally {
      setTesting(false);
    }
  };

  const providerOptions = [
    { value: 'openai', label: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4', 'gpt-3.5-turbo'] },
    { value: 'qianwen', label: '阿里云通义千问', models: ['qwen-max', 'qwen-turbo', 'qwen-plus'] },
    { value: 'claude', label: 'Anthropic Claude', models: ['claude-3-5-sonnet', 'claude-3-opus', 'claude-3-sonnet'] },
    { value: 'zhipu', label: '智谱清言', models: ['glm-4', 'glm-4-plus', 'glm-3-turbo'] },
    { value: 'custom', label: '自定义 (OpenAI 兼容)', models: [] },
  ];

  const getModelOptions = (provider: string) => {
    const opt = providerOptions.find(p => p.value === provider);
    return opt?.models || [];
  };

  return (
    <div className="h-full min-h-0 flex flex-col overflow-auto">
      <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 shrink-0">系统配置</h1>

      {loading ? (
        <div className="flex justify-center items-center flex-1 min-h-[200px]">
          <Spin size="large" />
        </div>
      ) : (
        <div className="w-full max-w-2xl min-w-0 flex-1">
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSave}
            className="w-full"
          >
            <Card
              title={
                <div className="flex items-center gap-2">
                  <SettingOutlined />
                  <span>基础设置</span>
                </div>
              }
              className="mb-4"
            >
              <Form.Item
                name="llm_provider"
                label={
                  <span className="flex items-center gap-1">
                    LLM 提供商
                    <Tooltip title="选择要使用的 LLM 服务提供商">
                      <InfoCircleOutlined className="text-gray-400" />
                    </Tooltip>
                  </span>
                }
                extra="不填则默认使用 OpenAI"
              >
                <Select className="w-full">
                  {providerOptions.map(opt => (
                    <Select.Option key={opt.value} value={opt.value}>
                      {opt.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Card>

            <Collapse
              defaultActiveKey={['engine']}
              ghost
              className="[&_.ant-collapse-item]:!border-gray-100 [&_.ant-collapse-content-box]:!px-0"
            >
              <Panel
                key="engine"
                header={
                  <div className="flex items-center gap-2 text-[15px] font-semibold text-gray-800">
                    <RocketOutlined className="text-violet-500" />
                    <span>配置引擎</span>
                  </div>
                }
              >
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4">
                  <Form.Item
                    name="llm_model"
                    label={
                      <span className="flex items-center gap-1">
                        模型名称
                        <Tooltip title="LLM 模型名称，如 gpt-4o-mini、qwen-max 等">
                          <InfoCircleOutlined className="text-gray-400" />
                        </Tooltip>
                      </span>
                    }
                    rules={[{ required: true, message: '请输入模型名称' }]}
                  >
                    <Input placeholder="gpt-4o-mini" className="!rounded-lg" />
                  </Form.Item>

                  <Form.Item
                    name="llm_api_key"
                    label={
                      <span className="flex items-center gap-1">
                        API Key
                        <Tooltip title="你的 API Key，支持 OpenAI、通义千问、Claude 等">
                          <InfoCircleOutlined className="text-gray-400" />
                        </Tooltip>
                      </span>
                    }
                    rules={[{ required: true, message: '请输入 API Key' }]}
                  >
                    <Input.Password placeholder="sk-xxxxx" className="!rounded-lg" />
                  </Form.Item>

                  <Form.Item
                    name="llm_base_url"
                    label={
                      <span className="flex items-center gap-1">
                        API 基础地址
                        <Tooltip title="LLM API 的基础 URL 地址">
                          <InfoCircleOutlined className="text-gray-400" />
                        </Tooltip>
                      </span>
                    }
                    rules={[{ required: true, message: '请输入 API 基础地址' }]}
                    extra="默认: https://api.openai.com/v1"
                  >
                    <Input placeholder="https://api.openai.com/v1" className="!rounded-lg" />
                  </Form.Item>
                </div>
              </Panel>
            </Collapse>

            {testResult && (
              <Alert
                type={testResult.success ? 'success' : 'error'}
                message={testResult.message}
                className="mt-4"
                showIcon
              />
            )}

            <div className="mt-4 flex items-center gap-3">
              <Button
                type="primary"
                htmlType="submit"
                loading={saving}
                className="!rounded-lg"
              >
                保存配置
              </Button>
              <Button
                icon={testing ? <LoadingOutlined /> : <CheckCircleOutlined />}
                onClick={handleTest}
                loading={testing}
                className="!rounded-lg"
              >
                测试连接
              </Button>
            </div>
          </Form>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
