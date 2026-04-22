import React, { useState, useRef } from 'react';
import {
  Upload, Button, Result, Tag, List, Progress, Space, Alert,
  Card, Collapse, Empty, Select, Divider,
} from 'antd';
import type { UploadFile } from 'antd';
import type { RcFile } from 'antd/es/upload';
import {
  UploadOutlined, FileTextOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ThunderboltOutlined, LinkOutlined, DownloadOutlined, ReloadOutlined,
  CheckOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import { analysisApi } from '../services/api';
import { ReviewTask, ReviewResult } from '../types';
import { tracker } from '../utils/tracker';

const { Panel } = Collapse;

const REVIEW_TYPES = [
  { label: '通用审查', value: 'general', desc: '适用于各类文档的全面合规检查' },
  { label: '专利审查', value: 'patent', desc: '专利申请书、权利要求书专项审查' },
  { label: '法律审查', value: 'law', desc: '法律法规合规性检查' },
  { label: '合同审查', value: 'contract', desc: '合同协议条款风险评估' },
];

const AnalysisPage: React.FC = () => {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [reviewType, setReviewType] = useState('general');
  const [loading, setLoading] = useState(false);
  const [task, setTask] = useState<ReviewTask | null>(null);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const startTimeRef = useRef<number>(0);

  const pollResult = async (taskId: string) => {
    let completed = false;
    const startTime = startTimeRef.current;
    const documentName = fileList[0]?.name || '未知文档';

    while (!completed) {
      try {
        const { data } = await analysisApi.getTask(taskId);
        setTask(data);
        if (data.status === 'completed') {
          const res = await analysisApi.getResult(taskId);
          setResult(res.data ?? null);

          // 记录审查完成埋点
          const duration = Date.now() - startTime;
          tracker.trackReviewComplete({
            document_id: taskId,
            document_name: documentName,
            review_type: data.review_type || reviewType,
            success: true,
            duration_ms: duration,
          });

          completed = true;
        } else if (data.status === 'failed') {
          setResult(null);

          // 记录审查失败埋点
          const duration = Date.now() - startTime;
          tracker.trackReviewComplete({
            document_id: taskId,
            document_name: documentName,
            review_type: data.review_type || reviewType,
            success: false,
            duration_ms: duration,
          });

          completed = true;
        } else {
          await new Promise(r => setTimeout(r, 2000));
        }
      } catch (error) {
        completed = true;
      }
    }
    setLoading(false);
  };

  const handleReview = async () => {
    const file = fileList[0]?.originFileObj;
    if (!file) return;

    setLoading(true);
    setTask(null);
    setResult(null);
    startTimeRef.current = Date.now();

    // 记录文档上传埋点
    tracker.trackDocumentUpload({
      document_name: file.name,
      review_type: reviewType,
      file_size: file.size,
      file_type: file.name.split('.').pop()?.toLowerCase() || 'unknown',
    });

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('review_type', reviewType);
      const { data } = await analysisApi.reviewWithFile(formData);
      setTask(data);

      // 记录审查提交埋点
      tracker.trackReviewSubmit({
        document_id: data.id,
        document_name: file.name,
        review_type: reviewType,
      });

      pollResult(data.id);
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'success';
      case 'medium': return 'warning';
      case 'high': return 'error';
      default: return 'default';
    }
  };

  const selectedType = REVIEW_TYPES.find(t => t.value === reviewType);
  const hasResult = result !== null || (task?.status === 'failed');
  const showInitialState = !task && !result;

  return (
    <div className="min-h-full">
      {/* 标题区 */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            合规性智能分析
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            上传待审查文档，系统将基于知识库进行多维度的合规性审查。
          </p>
        </div>
      </div>

      {/* 初始状态：居中上传卡 */}
      {showInitialState && (
        <div className="max-w-2xl mx-auto">
          <Card
            className="!rounded-2xl !border-gray-200 !bg-white shadow-sm"
            bodyStyle={{ padding: '40px 36px' }}
          >
            <input
              ref={uploadInputRef}
              type="file"
              accept=".pdf,.docx,.doc,.txt"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setFileList([{ uid: '-1', name: f.name, status: 'done', originFileObj: f as RcFile }]);
                e.target.value = '';
              }}
            />

            {/* 审查类型选择 */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                审查类型
              </label>
              <Select
                value={reviewType}
                onChange={(v) => setReviewType(v)}
                className="!w-full !rounded-xl"
                size="large"
                options={REVIEW_TYPES.map(t => ({
                  label: (
                    <div className="py-0.5">
                      <span className="font-medium">{t.label}</span>
                      <span className="text-gray-400 text-xs ml-2">{t.desc}</span>
                    </div>
                  ),
                  value: t.value,
                }))}
              />
              {selectedType && (
                <p className="text-xs text-gray-400 mt-1.5">
                  <ThunderboltOutlined className="mr-1 text-violet-400" />
                  {selectedType.desc}
                </p>
              )}
            </div>

            <Divider className="!my-5" />

            {/* 上传区 */}
            <Upload.Dragger
              fileList={fileList}
              beforeUpload={() => false}
              maxCount={1}
              accept=".pdf,.docx,.doc,.txt"
              onRemove={() => setFileList([])}
              onChange={({ fileList: fl }) => setFileList(fl)}
              showUploadList={false}
              className="!border-dashed !border-2 !border-gray-200 !rounded-xl !bg-gray-50/60 hover:!border-violet-400 [&_.ant-upload-drag-icon]:!mb-2"
            >
              <div className="py-4">
                <div className="relative inline-block mb-3">
                  <div className="w-16 h-20 rounded-xl border-2 border-gray-200 bg-white flex items-center justify-center">
                    <UploadOutlined className="text-3xl text-gray-400" />
                  </div>
                  <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-violet-500 flex items-center justify-center text-white text-xs shadow-sm">
                    <ThunderboltOutlined />
                  </span>
                </div>
                <p className="text-base font-semibold text-gray-800 mb-0.5">
                  拖拽文件或点击上传
                </p>
                <p className="text-sm text-gray-500">
                  支持 PDF、Word（.docx）、TXT 格式
                </p>
              </div>
            </Upload.Dragger>

            {/* 已选文件 */}
            {fileList.length > 0 && (
              <div className="mt-4 p-3 rounded-xl bg-gray-50/80 border border-gray-100 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center shrink-0">
                  <FileTextOutlined className="text-violet-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {fileList[0].name}
                  </p>
                  <p className="text-xs text-gray-400">待审查文档</p>
                </div>
                <Button
                  size="small"
                  type="text"
                  onClick={() => setFileList([])}
                  className="text-gray-400 hover:text-red-500 shrink-0"
                >
                  移除
                </Button>
              </div>
            )}

            {/* 底部操作 */}
            <div className="mt-5" onClick={(e) => {
              const target = e.target as HTMLElement;
              const button = target.closest('button');
              if (button) {
                tracker.trackClick({
                  element_id: button.id || undefined,
                  element_text: button.textContent?.trim() || undefined,
                  page_url: '/review',
                });
              }
            }}>
              {fileList.length > 0 ? (
                <Button
                  type="primary"
                  size="large"
                  block
                  loading={loading}
                  icon={<ThunderboltOutlined />}
                  className="!rounded-xl !bg-gray-900 !border-gray-900 hover:!bg-gray-800 hover:!border-gray-800 !h-12 !text-base"
                  onClick={handleReview}
                >
                  开始审查
                </Button>
              ) : (
                <Button
                  size="large"
                  block
                  icon={<UploadOutlined />}
                  className="!rounded-xl !h-12 !text-base"
                  onClick={() => uploadInputRef.current?.click()}
                >
                  + 上传待审查文档
                </Button>
              )}
            </div>

            {/* 特性标签 */}
            <div className="flex flex-wrap items-center justify-center gap-5 pt-5 mt-4 border-t border-gray-100">
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <CheckOutlined className="text-teal-400 text-xs" />
                支持 PDF / WORD
              </span>
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <CheckOutlined className="text-teal-400 text-xs" />
                RAG 增强分析
              </span>
            </div>
          </Card>
        </div>
      )}

      {/* 审查中：进度 */}
      {task && !hasResult && (
        <div className="max-w-2xl mx-auto">
          <Card className="!rounded-2xl !border-gray-100" bodyStyle={{ padding: 48 }}>
            {/* 显示文件名和类型 */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center">
                <FileTextOutlined className="text-violet-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">{task.task_name}</p>
                <p className="text-xs text-gray-400">
                  审查类型：{REVIEW_TYPES.find(t => t.value === (task as any).review_type)?.label ?? task.review_type}
                </p>
              </div>
              <Tag color="processing" className="ml-auto">审查中</Tag>
            </div>
            <div className="text-center py-4">
              <Progress type="circle" percent={60} status="active" strokeColor="#7c3aed" size={120} />
              <p className="mt-6 text-gray-700 font-medium">正在审查中，请稍候...</p>
              <p className="text-sm text-gray-400 mt-1">
                基于知识库「{task.task_name?.split('审查:')[1]?.trim() ?? '相关法规'}」进行合规分析
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* 审查完成：结果 */}
      {hasResult && (
        <div className="max-w-3xl mx-auto space-y-5">
          {/* 结论卡片 */}
          <Card className="!rounded-2xl !border-gray-100">
            {result ? (
              <>
                <Result
                  icon={result.compliance
                    ? <CheckCircleOutlined style={{ color: '#10b981', fontSize: 56 }} />
                    : <CloseCircleOutlined style={{ color: '#ef4444', fontSize: 56 }} />
                  }
                  title={
                    <span className="text-xl">{result.compliance ? '合规通过' : '存在合规风险'}</span>
                  }
                  subTitle={
                    <div className="flex items-center gap-2 mt-1">
                      <Tag color={getRiskColor(result.risk_level)} className="!text-sm">
                        风险等级：{result.risk_level === 'low' ? '低' : result.risk_level === 'medium' ? '中' : '高'}
                      </Tag>
                    </div>
                  }
                />
                <Alert
                  type={result.compliance ? 'success' : 'warning'}
                  message={<span className="text-sm leading-relaxed">{result.summary}</span>}
                  showIcon
                  className="!rounded-xl !mt-2"
                />
              </>
            ) : (
              <Result
                status="error"
                title="审查失败"
                subTitle={task?.error_message || '请稍后重试或更换文档'}
              />
            )}
          </Card>

          {result && (
            <>
              {/* 问题与对比 */}
              <Card
                title={<><ExclamationCircleOutlined className="mr-2 text-amber-500" />问题与对比</>}
                className="!rounded-2xl !border-gray-100"
              >
                {result.findings && result.findings.length > 0 ? (
                  <List
                    size="default"
                    dataSource={result.findings}
                    renderItem={(item) => (
                      <List.Item className="!border-gray-100">
                        <div className="w-full py-1">
                          <Space className="mb-2 flex-wrap">
                            <Tag color={getRiskColor(item.severity)}>
                              {item.severity === 'high' ? '高' : item.severity === 'medium' ? '中' : '低'}风险
                            </Tag>
                            <Tag>{item.type === 'risk' ? '风险' : item.type === 'suggestion' ? '建议' : '错误'}</Tag>
                          </Space>
                          <p className="text-gray-800 mb-1">{item.description}</p>
                          {item.reference && (
                            <p className={`text-sm ${(item as any).verification_status === 'unverified' ? 'text-amber-600' : 'text-gray-500'}`}>
                              {(item as any).verification_status === 'unverified' && '⚠️ '}
                              依据：{item.reference}
                            </p>
                          )}
                          {item.suggestion && (
                            <p className="text-violet-600 text-sm mt-1">
                              建议：{item.suggestion}
                            </p>
                          )}
                        </div>
                      </List.Item>
                    )}
                  />
                ) : (
                  <Empty description="未发现合规问题" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </Card>

              {/* 引用依据 */}
              {result.referenced_documents && result.referenced_documents.length > 0 && (
                <Card
                  title={<><LinkOutlined className="mr-2 text-sky-500" />引用依据</>}
                  className="!rounded-2xl !border-gray-100"
                >
                  <List
                    size="default"
                    dataSource={result.referenced_documents}
                    renderItem={(item) => (
                      <List.Item className="!border-gray-100">
                        <div className="w-full">
                          <div className="flex items-center gap-2">
                            <FileTextOutlined className="text-gray-400 shrink-0" />
                            <span className="text-gray-800">{item.title}</span>
                            <Tag color="blue" className="ml-auto shrink-0">
                              匹配度 {Math.round((item.relevance ?? 0) * 100)}%
                            </Tag>
                          </div>
                          {item.matched_chunks && item.matched_chunks.length > 0 && (
                            <Collapse ghost className="!mt-2 [&_.ant-collapse-header]:!p-0">
                              <Panel header={<span className="text-xs text-gray-500">查看引用片段</span>} key="1">
                                {item.matched_chunks.map((chunk, ci) => (
                                  <p key={ci} className="text-sm text-gray-600 bg-gray-50 rounded-lg p-2.5 mb-2 last:mb-0 leading-relaxed">
                                    {chunk}
                                  </p>
                                ))}
                              </Panel>
                            </Collapse>
                          )}
                        </div>
                      </List.Item>
                    )}
                  />
                </Card>
              )}

              {/* 操作栏 */}
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  icon={<ReloadOutlined />}
                  onClick={() => { setTask(null); setResult(null); setFileList([]); }}
                  className="!rounded-lg"
                >
                  重新审查
                </Button>
                <Button icon={<DownloadOutlined />} className="!rounded-lg">
                  导出报告
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AnalysisPage;
