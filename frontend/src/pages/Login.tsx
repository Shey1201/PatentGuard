import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, message } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';
import { useAuthStore } from '../stores/auth';
import { tracker } from '../utils/tracker';

interface LoginForm {
  email: string;
  password: string;
}

interface RegisterForm extends LoginForm {
  username: string;
}

const LoginPage: React.FC = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const onFinishLogin = async (values: LoginForm) => {
    setLoading(true);
    try {
      const { data } = await authApi.login(values);
      setAuth(data.user, data.access_token);

      // 记录登录成功埋点
      tracker.trackLogin('password', true);
      tracker.setUserId(data.user.id);

      message.success('登录成功');
      navigate('/');
    } catch (error: any) {
      // 记录登录失败埋点
      tracker.trackLogin('password', false);
      message.error(error.response?.data?.detail || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const onFinishRegister = async (values: RegisterForm) => {
    setLoading(true);
    try {
      const { data } = await authApi.register(values);
      setAuth(data.user, data.access_token);

      // 记录注册成功埋点
      tracker.track({
        event_name: 'register',
        event_category: 'user_action',
        properties: { method: 'email' },
      });
      tracker.setUserId(data.user.id);

      message.success('注册成功');
      navigate('/');
    } catch (error: any) {
      message.error(error.response?.data?.detail || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <Card className="w-96 shadow-xl" title={<div className="text-center text-xl font-bold">PatentGuard</div>}>
        <h2 className="text-center text-gray-600 mb-6">
          {isRegister ? '用户注册' : '用户登录'}
        </h2>

        <Form
          name={isRegister ? 'register' : 'login'}
          onFinish={isRegister ? onFinishRegister : onFinishLogin}
          autoComplete="off"
          size="large"
        >
          {isRegister && (
            <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
              <Input prefix={<UserOutlined />} placeholder="用户名" />
            </Form.Item>
          )}

          <Form.Item name="email" rules={[{ required: true, type: 'email', message: '请输入有效的邮箱' }]}>
            <Input prefix={<MailOutlined />} placeholder="邮箱" />
          </Form.Item>

          <Form.Item name="password" rules={[{ required: true, min: 6, message: '密码至少6位' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              {isRegister ? '注册' : '登录'}
            </Button>
          </Form.Item>

          <div className="text-center">
            <span className="text-gray-500">
              {isRegister ? '已有账号？' : '还没有账号？'}
            </span>
            <Button type="link" onClick={() => setIsRegister(!isRegister)}>
              {isRegister ? '立即登录' : '立即注册'}
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default LoginPage;
