export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            events: {
                Row: {
                    id: string
                    name: string
                    slug: string
                    date: string
                    description: string | null
                    is_active: boolean
                    config: Json | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    name: string
                    slug: string
                    date: string
                    description?: string | null
                    is_active?: boolean
                    config?: Json | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    name?: string
                    slug?: string
                    date?: string
                    description?: string | null
                    is_active?: boolean
                    config?: Json | null
                    created_at?: string
                }
            }
            photos: {
                Row: {
                    id: string
                    storage_path: string
                    event_id: string | null
                    image_url: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    storage_path: string
                    event_id?: string | null
                    image_url?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    storage_path?: string
                    event_id?: string | null
                    image_url?: string | null
                    created_at?: string
                }
            }
            sessions: {
                Row: {
                    id: string
                    created_at: string
                    status: 'active' | 'completed'
                }
                Insert: {
                    id?: string
                    created_at?: string
                    status?: 'active' | 'completed'
                }
                Update: {
                    id?: string
                    created_at?: string
                    status?: 'active' | 'completed'
                }
            }
            templates: {
                Row: {
                    id: string
                    name: string
                    thumbnail_url: string | null
                    overlay_url: string
                    category: string
                    is_active: boolean
                    created_at: string
                }
                Insert: {
                    id?: string
                    name: string
                    thumbnail_url?: string | null
                    overlay_url: string
                    category?: string
                    is_active?: boolean
                    created_at?: string
                }
                Update: {
                    id?: string
                    name?: string
                    thumbnail_url?: string | null
                    overlay_url?: string
                    category?: string
                    is_active?: boolean
                    created_at?: string
                }
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            [_ in never]: never
        }
        Enums: {
            [_ in never]: never
        }
    }
}
