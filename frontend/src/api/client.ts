import axios from 'axios'

import type { ApiResponse } from '@/types'

const client = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10_000,
})

client.interceptors.response.use(
  (res) => res,
  (err) => {
    const message = err.response?.data?.error ?? err.message ?? 'An unexpected error occurred'
    return Promise.reject(new Error(message))
  },
)

export async function get<T>(path: string): Promise<T> {
  const res = await client.get<ApiResponse<T>>(path)
  if (res.data.error) throw new Error(res.data.error)
  return res.data.data as T
}

export async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await client.post<ApiResponse<T>>(path, body)
  if (res.data.error) throw new Error(res.data.error)
  return res.data.data as T
}

export async function del<T>(path: string): Promise<T> {
  const res = await client.delete<ApiResponse<T>>(path)
  if (res.data.error) throw new Error(res.data.error)
  return res.data.data as T
}

export default client
