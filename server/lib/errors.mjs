/**
 * 统一错误契约。
 * 错误码按模块分千位段（沿用团队既有约定）：
 *   1xxx 鉴权 / 账号          2xxx 提醒业务
 *   3xxx 上传                4xxx 权限
 *   8xxx 限流                9xxx 系统
 * 响应体统一为 ApiResponse { code, message, data }，code=0 表示成功。
 */

export const CODES = {
  OK: 0,

  // 1xxx 鉴权 / 账号
  AUTH_INVALID_PARAMS: 1001,
  AUTH_USERNAME_TAKEN: 1002,
  AUTH_BAD_CREDENTIALS: 1003,
  AUTH_WEAK_PASSWORD: 1004,
  AUTH_TOKEN_INVALID: 1005,
  AUTH_REFRESH_REVOKED: 1006,
  AUTH_REFRESH_REUSED: 1007,
  AUTH_STATE_INVALID: 1008,
  AUTH_WECHAT_FAILED: 1009,
  AUTH_USER_DISABLED: 1010,
  AUTH_SESSION_NOT_FOUND: 1011,

  // 2xxx 提醒业务
  REMINDER_INVALID_PARAMS: 2001,
  REMINDER_NOT_FOUND: 2002,
  REMINDER_BAD_CATEGORY: 2003,
  REMINDER_BAD_DEADLINE: 2004,
  REMINDER_BAD_URL: 2005,

  // 3xxx 上传
  UPLOAD_TOO_LARGE: 3001,
  UPLOAD_BAD_TYPE: 3002,
  UPLOAD_FAILED: 3003,

  // 4xxx 权限
  FORBIDDEN_ROLE: 4001,
  FORBIDDEN_RESOURCE: 4002,

  // 8xxx 限流
  RATE_LIMITED: 8001,

  // 9xxx 系统
  SYSTEM_INTERNAL: 9000,
  SYSTEM_NOT_FOUND: 9004,
  SYSTEM_METHOD_NOT_ALLOWED: 9005,
};

export const MESSAGES = {
  [CODES.OK]: '成功',
  [CODES.AUTH_INVALID_PARAMS]: '请求参数校验失败',
  [CODES.AUTH_USERNAME_TAKEN]: '该用户名已被注册',
  [CODES.AUTH_BAD_CREDENTIALS]: '用户名或密码错误',
  [CODES.AUTH_WEAK_PASSWORD]: '密码强度不足',
  [CODES.AUTH_TOKEN_INVALID]: '登录状态无效或已过期',
  [CODES.AUTH_REFRESH_REVOKED]: '会话已失效，请重新登录',
  [CODES.AUTH_REFRESH_REUSED]: '检测到令牌重放，已强制下线该设备',
  [CODES.AUTH_STATE_INVALID]: '授权状态校验失败，请重新发起登录',
  [CODES.AUTH_WECHAT_FAILED]: '微信授权失败',
  [CODES.AUTH_USER_DISABLED]: '账号已被禁用',
  [CODES.AUTH_SESSION_NOT_FOUND]: '未找到该登录设备',

  [CODES.REMINDER_INVALID_PARAMS]: '提醒参数不合法',
  [CODES.REMINDER_NOT_FOUND]: '提醒不存在或已被删除',
  [CODES.REMINDER_BAD_CATEGORY]: '考试类型不在支持的分类中',
  [CODES.REMINDER_BAD_DEADLINE]: '截止日期格式应为 YYYY-MM-DD',
  [CODES.REMINDER_BAD_URL]: '公告链接必须是 http/https 地址',

  [CODES.UPLOAD_TOO_LARGE]: '文件超出大小限制',
  [CODES.UPLOAD_BAD_TYPE]: '仅支持 png/jpg/webp 图片',
  [CODES.UPLOAD_FAILED]: '文件保存失败',

  [CODES.FORBIDDEN_ROLE]: '当前角色无权执行该操作',
  [CODES.FORBIDDEN_RESOURCE]: '无权访问他人数据',

  [CODES.RATE_LIMITED]: '操作过于频繁，请稍后再试',

  [CODES.SYSTEM_INTERNAL]: '服务内部错误',
  [CODES.SYSTEM_NOT_FOUND]: '接口不存在',
  [CODES.SYSTEM_METHOD_NOT_ALLOWED]: '请求方法不被允许',
};

export class AppError extends Error {
  constructor(code, message, httpStatus = 400) {
    super(message || MESSAGES[code] || '请求失败');
    this.name = 'AppError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export const fail = (code, message, httpStatus = 400) => new AppError(code, message, httpStatus);

/** 统一成功响应 */
export const ok = (data = null, message = '成功') => ({ code: CODES.OK, message, data });
