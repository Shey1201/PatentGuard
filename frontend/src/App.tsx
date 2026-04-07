import React, { useEffect, useRef, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Avatar, Dropdown, Button } from 'antd';
import type { MenuProps } from 'antd';
import {
  DashboardOutlined,
  DatabaseOutlined,
  FileSearchOutlined,
  HistoryOutlined,
  SettingOutlined,
  LogoutOutlined,
  UserOutlined,
  SafetyCertificateOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { useAuthStore } from './stores/auth';
import { useAppModeStore } from './stores/appMode';
import LoginPage from './pages/Login';
import Dashboard from './pages/Dashboard';
import KnowledgeBasePage from './pages/KnowledgeBase';
import AnalysisPage from './pages/Analysis';
import SettingsPage from './pages/Settings';
import HistoryPage from './pages/History';

const { Header, Sider, Content } = Layout;

const AppLayoutShell: React.FC = () => {
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);
  const viewMode = useAppModeStore((s) => s.viewMode);
  const setViewMode = useAppModeStore((s) => s.setViewMode);
  const navigate = useNavigate();
  const location = useLocation();

  const adminMenu: MenuProps['items'] = [
    { key: 'admin', icon: <DashboardOutlined />, label: '工作台' },
    { key: 'admin/knowledge', icon: <DatabaseOutlined />, label: '知识库管理' },
    { key: 'admin/settings', icon: <SettingOutlined />, label: '系统设置' },
  ];

  const userMenu: MenuProps['items'] = [
    { key: 'home', icon: <DashboardOutlined />, label: '工作台' },
    { key: 'review', icon: <FileSearchOutlined />, label: '文档审查' },
    { key: 'history', icon: <HistoryOutlined />, label: '历史记录' },
  ];

  const items = viewMode === 'admin' ? adminMenu : userMenu;

  // 根据路径和视图模式确定当前菜单 key
  const currentKey = (() => {
    const p = location.pathname;
    if (viewMode === 'admin') {
      if (p.startsWith('/admin/knowledge')) return 'admin/knowledge';
      if (p.startsWith('/admin/settings')) return 'admin/settings';
      return 'admin';
    }
    if (p === '/review') return 'review';
    if (p === '/history') return 'history';
    return 'home';
  })();

  const onMenuClick: MenuProps['onClick'] = ({ key }) => {
    const path = key === 'home' ? '/' : key === 'admin' ? '/admin' : `/${key}`;
    navigate(path);
  };

  const onUserMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'logout') {
      logout();
    }
  };

  const toggleViewMode = () => {
    if (viewMode === 'admin') {
      setViewMode('user');
      navigate('/', { replace: true });
    } else {
      setViewMode('admin');
      navigate('/admin', { replace: true });
    }
  };

  const userDropdown: MenuProps['items'] = [
    {
      key: 'user-info',
      label: (
        <div className="px-1 py-0.5">
          <div className="text-sm font-medium text-gray-800">{user?.username ?? '用户'}</div>
          <div className="text-xs text-gray-400 mt-0.5">{user?.email}</div>
        </div>
      ),
      disabled: true,
    },
    { type: 'divider' },
    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', danger: true },
  ];

  // 防重复触发守卫
  const guardRef = useRef<number>(0);

  useEffect(() => {
    const now = Date.now();
    if (now - guardRef.current < 500) return;
    guardRef.current = now;
    // 确保视图模式与路径一致
    if (viewMode === 'admin' && location.pathname === '/') {
      navigate('/admin', { replace: true });
    } else if (viewMode === 'user' && location.pathname.startsWith('/admin')) {
      navigate('/', { replace: true });
    }
  }, [viewMode, location.pathname, navigate]);

  // 根据当前路径渲染对应页面内容
  const renderContent = useCallback(() => {
    const p = location.pathname;
    // 管理员视图
    if (viewMode === 'admin') {
      if (p.startsWith('/admin/knowledge')) return <KnowledgeBasePage />;
      if (p.startsWith('/admin/settings')) return <SettingsPage />;
      return <Dashboard />;
    }
    // 用户视图
    if (p === '/review') return <AnalysisPage />;
    if (p === '/history') return <HistoryPage />;
    return <Dashboard />;
  }, [viewMode, location.pathname]);

  // 顶栏页面标题
  const pageTitle = (() => {
    const p = location.pathname;
    if (viewMode === 'admin') {
      if (p.startsWith('/admin/knowledge')) return '知识库管理';
      if (p.startsWith('/admin/settings')) return '系统设置';
      return '工作台';
    }
    if (p === '/review') return '合规性智能分析';
    if (p === '/history') return '历史记录';
    return '个人工作台';
  })();

  const SIDER_WIDTH = 196;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        theme="light"
        width={SIDER_WIDTH}
        breakpoint="lg"
        collapsedWidth={0}
        className="pg-sider-light pg-sider-fixed"
        style={{
          background: '#fafafa',
          borderRight: '1px solid #f0f0f0',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          height: '100vh',
          overflowY: 'auto',
          zIndex: 100,
        }}
      >
        <div
          className="h-[52px] flex flex-col justify-center px-4 border-b border-gray-200"
          style={{ fontSize: 15 }}
        >
          <div className="text-gray-900 font-bold tracking-tight leading-tight">PatentGuard</div>
          <div className="text-[10px] text-gray-500 mt-0.5 tracking-wide">
            {viewMode === 'admin' ? '后台管理' : '用户端'}
          </div>
        </div>
        <Menu
          theme="light"
          mode="inline"
          selectedKeys={[currentKey]}
          items={items}
          onClick={onMenuClick}
          style={{
            background: 'transparent',
            border: 'none',
            fontSize: 13,
            marginTop: 8,
          }}
        />
      </Sider>
      <Layout className="pg-main-layout">
        <Header
          className="flex items-center gap-4 px-4 md:px-6 bg-white border-b border-gray-100"
          style={{
            height: 56,
            lineHeight: '56px',
            padding: '0 24px',
            boxShadow: '0 1px 0 rgba(0,0,0,0.04)',
          }}
        >
          {/* 左侧：Logo + 品牌名 */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-lg bg-gray-900 flex items-center justify-center shrink-0">
              <SafetyCertificateOutlined className="text-white text-lg" />
            </div>
            <span className="font-semibold text-gray-900 text-base hidden sm:inline">PatentGuard AI</span>
            <div className="w-px h-5 bg-gray-200 hidden sm:block" />
          </div>

          {/* 中左：当前页面标题 */}
          <span className="text-[15px] text-gray-700 truncate flex-1 min-w-0 pl-2">
            {pageTitle}
          </span>

          {/* 右侧：视图切换 + 用户头像 */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-px h-5 bg-gray-200" />
            <Button
              type="default"
              size="middle"
              onClick={toggleViewMode}
              className="!rounded-lg border-gray-200 text-gray-700 hover:!border-violet-300 hover:!text-violet-600"
            >
              {viewMode === 'admin' ? '管理员视图' : '用户视图'}
            </Button>
            <Dropdown menu={{ items: userDropdown, onClick: onUserMenuClick }} placement="bottomRight" trigger={['click']}>
              <button
                type="button"
                className="flex items-center gap-2 cursor-pointer border-0 bg-transparent hover:opacity-80 text-left"
              >
                <Avatar size={36} icon={<UserOutlined />} className="bg-violet-600 shrink-0" />
                <div className="min-w-0 hidden sm:block">
                  <div className="text-sm font-medium text-gray-900 truncate">{user?.username ?? '用户'}</div>
                </div>
              </button>
            </Dropdown>
          </div>
        </Header>
        <Content className="p-5 md:p-6 bg-[#f4f6f9] flex-1 overflow-auto flex flex-col min-h-0">
          {renderContent()}
        </Content>
      </Layout>
    </Layout>
  );
};

const App: React.FC = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const viewMode = useAppModeStore((s) => s.viewMode);

  // 未登录：强制跳转登录
  if (!isAuthenticated) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    );
  }

  // 已登录：布局包裹，路由全在根级
  return (
    <BrowserRouter>
      <Routes>
        {/* 登录页（已登录则重定向） */}
        <Route path="/login" element={<Navigate to="/" replace />} />

        {/* 主布局容器 */}
        <Route path="/" element={<AppLayoutShell />}>
          <Route index element={<Navigate to="/" replace />} />
        </Route>

        {/* /admin 开头的管理员路由 */}
        <Route path="/admin" element={<AppLayoutShell />} />
        <Route path="/admin/knowledge" element={<AppLayoutShell />} />
        <Route path="/admin/settings" element={<AppLayoutShell />} />

        {/* 用户路由 */}
        <Route path="/review" element={<AppLayoutShell />} />
        <Route path="/history" element={<AppLayoutShell />} />

        {/* 兜底 */}
        <Route path="*" element={<Navigate to={viewMode === 'admin' ? '/admin' : '/'} replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
