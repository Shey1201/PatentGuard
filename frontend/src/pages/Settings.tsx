import React, { useEffect, useState } from 'react';
import { Alert, Button, Card, Collapse, Form, Input, message, Spin, Tooltip } from 'antd';
import {
  CheckCircleOutlined,
  InfoCircleOutlined,
  LoadingOutlined,
  RocketOutlined,
  SettingOutlined,
} from '@ant-design/icons';
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
        llm_provider: data.llm_provider || 'custom',
        llm_model: data.llm_model || '',
        llm_api_key: data.llm_api_key || '',
        llm_base_url: data.llm_base_url || '',
      });
    } catch (error) {
      console.warn('加载配置失败，使用空白自定义配置');
      form.setFieldsValue({
        llm_provider: 'custom',
        llm_model: '',
        llm_api_key: '',
        llm_base_url: '',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (values: any) => {
    setSaving(true);
    try {
      await systemApi.updateLLMConfig({
        llm_provider: values.llm_provider || 'custom',
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
        setTestResult({ success: true, message: `连接成功：${data.response}` });
      } else {
        setTestResult({ success: false, message: `连接失败：${data.error}` });
      }
    } catch (error: any) {
      setTestResult({ success: false, message: `测试失败：${error?.message || '网络错误'}` });
    } finally {
      setTesting(false);
    }
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
            initialValues={{ llm_provider: 'custom' }}
          >
            <Form.Item name="llm_provider" hidden>
              <Input />
            </Form.Item>

            <Card
              title={
                <div className="flex items-center gap-2">
                  <SettingOutlined />
                  <span>自定义 LLM 配置</span>
                </div>
              }
              className="mb-4"
            >
              <Alert
                type="info"
                showIcon
                message="请填写兼容 Chat Completions 格式的接口地址、模型名和 API Key。"
              />
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
                    <span>模型调用配置</span>
                  </div>
                }
              >
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4">
                  <Form.Item
                    name="llm_base_url"
                    label={
                      <span className="flex items-center gap-1">
                        API 基础地址
                        <Tooltip title="后端会调用 {base_url}/chat/completions">
                          <InfoCircleOutlined className="text-gray-400" />
                        </Tooltip>
                      </span>
                    }
                    rules={[{ required: true, message: '请输入 API 基础地址' }]}
                  >
                    <Input placeholder="https://your-llm-endpoint.example/v1" className="!rounded-lg" />
                  </Form.Item>

                  <Form.Item
                    name="llm_model"
                    label={
                      <span className="flex items-center gap-1">
                        模型名称
                        <Tooltip title="填写服务端实际支持的模型名称">
                          <InfoCircleOutlined className="text-gray-400" />
                        </Tooltip>
                      </span>
                    }
                    rules={[{ required: true, message: '请输入模型名称' }]}
                  >
                    <Input placeholder="your-chat-model" className="!rounded-lg" />
                  </Form.Item>

                  <Form.Item
                    name="llm_api_key"
                    label={
                      <span className="flex items-center gap-1">
                        API Key
                        <Tooltip title="填写该模型服务对应的 API Key">
                          <InfoCircleOutlined className="text-gray-400" />
                        </Tooltip>
                      </span>
                    }
                    rules={[{ required: true, message: '请输入 API Key' }]}
                  >
                    <Input.Password placeholder="your-api-key" className="!rounded-lg" />
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
              <Button type="primary" htmlType="submit" loading={saving} className="!rounded-lg">
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
