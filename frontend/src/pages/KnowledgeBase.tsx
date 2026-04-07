import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Tag, Modal, Form, Input, Select, Upload, message, Popconfirm } from 'antd';
import { PlusOutlined, UploadOutlined } from '@ant-design/icons';
import { kbApi } from '../services/api';
import { Category, Document } from '../types';
import dayjs from 'dayjs';

const KnowledgeBasePage: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [uploadForm] = Form.useForm();

  useEffect(() => {
    loadCategories();
    loadDocuments();
  }, [selectedCategory]);

  const loadCategories = async () => {
    try {
      const res = await kbApi.getCategories();
      const data = res?.data ?? res;
      setCategories(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.warn('加载分类失败', error);
      setCategories([]);
      if (error?.response?.status !== 401) {
        message.error('加载分类失败，请检查网络或登录状态');
      }
    }
  };

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const params: any = { page: 1, page_size: 100 };
      if (selectedCategory) params.category_id = selectedCategory;
      const res = await kbApi.getDocuments(params);
      const data = res?.data ?? res;
      setDocuments(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.warn('加载文档失败', error);
      setDocuments([]);
      if (error?.response?.status !== 401) {
        message.error('加载文档失败，请检查网络或登录状态');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async (values: any) => {
    try {
      await kbApi.createCategory(values);
      message.success('分类创建成功');
      setCategoryModalVisible(false);
      form.resetFields();
      loadCategories();
    } catch (error) {
      message.error('创建失败');
    }
  };

  const handleUpload = async (values: any) => {
    const formData = new FormData();
    formData.append('file', values.file[0].originFileObj);
    formData.append('category_id', values.category_id);
    formData.append('document_type', values.document_type);

    try {
      await kbApi.uploadDocument(formData);
      message.success('文档上传成功');
      setUploadModalVisible(false);
      uploadForm.resetFields();
      loadDocuments();
    } catch (error) {
      message.error('上传失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await kbApi.deleteDocument(id);
      message.success('删除成功');
      loadDocuments();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleProcess = async (id: string) => {
    try {
      await kbApi.processDocument(id);
      message.success('处理完成');
      loadDocuments();
    } catch (error) {
      message.error('处理失败');
    }
  };

  const columns = [
    {
      title: '文档名称',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: '类型',
      dataIndex: 'file_type',
      key: 'file_type',
      render: (type: string) => <Tag color="blue">{type?.toUpperCase()}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const color = status === 'completed' ? 'green' : status === 'processing' ? 'orange' : 'default';
        return <Tag color={color}>{status}</Tag>;
      },
    },
    {
      title: '上传时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Document) => (
        <Space>
          {record.status === 'pending' && (
            <Button type="link" size="small" onClick={() => handleProcess(record.id)}>
              处理
            </Button>
          )}
          <Popconfirm title="确定删除?" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" danger size="small">
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">知识库管理</h1>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCategoryModalVisible(true)}>
            新建分类
          </Button>
          <Button type="primary" icon={<UploadOutlined />} onClick={() => setUploadModalVisible(true)}>
            上传文档
          </Button>
        </Space>
      </div>

      <div className="mb-4">
        <Space wrap>
          <Button
            type={selectedCategory === null ? 'primary' : 'default'}
            onClick={() => setSelectedCategory(null)}
          >
            全部
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat.id}
              type={selectedCategory === cat.id ? 'primary' : 'default'}
              onClick={() => setSelectedCategory(cat.id)}
            >
              {cat.name} ({cat.document_count})
            </Button>
          ))}
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={documents}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title="新建分类"
        open={categoryModalVisible}
        onCancel={() => setCategoryModalVisible(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} onFinish={handleCreateCategory} layout="vertical">
          <Form.Item name="name" label="分类名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="law">法律法规</Select.Option>
              <Select.Option value="patent">专利文档</Select.Option>
              <Select.Option value="policy">政策文件</Select.Option>
              <Select.Option value="contract">合同协议</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="上传文档"
        open={uploadModalVisible}
        onCancel={() => setUploadModalVisible(false)}
        onOk={() => uploadForm.submit()}
      >
        <Form form={uploadForm} onFinish={handleUpload} layout="vertical">
          <Form.Item name="file" label="选择文件" rules={[{ required: true }]} valuePropName="fileList" getValueFromEvent={(e) => (Array.isArray(e) ? e : e?.fileList)}>
            <Upload.Dragger beforeUpload={() => false} maxCount={1}>
              <p className="ant-upload-drag-icon">
                <UploadOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽文件到此区域</p>
              <p className="ant-upload-hint">支持 PDF、Word、TXT 文件</p>
            </Upload.Dragger>
          </Form.Item>
          <Form.Item name="category_id" label="分类" rules={[{ required: true }]}>
            <Select>
              {categories.map((cat) => (
                <Select.Option key={cat.id} value={cat.id}>
                  {cat.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="document_type" label="文档类型">
            <Select>
              <Select.Option value="law">法律法规</Select.Option>
              <Select.Option value="patent">专利文档</Select.Option>
              <Select.Option value="policy">政策文件</Select.Option>
              <Select.Option value="contract">合同协议</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default KnowledgeBasePage;
