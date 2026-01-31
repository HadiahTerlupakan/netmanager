/**
 * Common types yang digunakan across application
 */

// Pagination parameters untuk API calls
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Standard API response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Paginated response
export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Common status types
export type Status = 'active' | 'inactive' | 'pending' | 'completed' | 'cancelled';

// Common date range filter
export interface DateRangeFilter {
  startDate?: Date | string;
  endDate?: Date | string;
}

// File upload response
export interface FileUploadResponse {
  url: string;
  filename: string;
  size: number;
  mimeType: string;
}

// Search parameters
export interface SearchParams extends PaginationParams {
  query?: string;
  filters?: Record<string, unknown>;
}

// ID parameter
export interface IdParam {
  id: string;
}

// Common entity timestamps
export interface Timestamps {
  createdAt: Date;
  updatedAt: Date;
}

// Site filter parameter (commonly used across app)
export interface SiteFilterParams {
  siteId?: string;
}

// User basic info
export interface UserBasicInfo {
  id: string;
  name: string;
  email: string;
  role?: string;
}

// Coordinate/Location
export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Location extends Coordinates {
  address?: string;
}

// Select option for dropdowns
export interface SelectOption<T = string> {
  label: string;
  value: T;
  disabled?: boolean;
}

// Chart data
export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

// Error response
export interface ErrorResponse {
  success: false;
  error: string;
  message?: string;
  details?: unknown;
}

// Success response
export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

// Union type for API responses
export type ApiResult<T> = SuccessResponse<T> | ErrorResponse;
