export interface Profile {
  id: string
  full_name: string | null
  role: 'admin' | 'user'
  created_at: string
  updated_at: string
}