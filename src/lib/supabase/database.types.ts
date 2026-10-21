
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "clients": {
                  Row: {
                    "created_at": string,"created_by": string,"email": string,"full_name": string,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string,"email": string,"full_name": string,"id"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"email"?: string,"full_name"?: string,"id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "clients_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"holds": {
                  Row: {
                    "client_id": string,"confirmed_at": string | null,"confirmed_by": string | null,"created_at": string,"created_by": string,"id": string,"slot_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"confirmed_at"?: string | null,"confirmed_by"?: string | null,"created_at"?: string,"created_by"?: string,"id"?: string,"slot_id": string
                  }
                  Update: {
                    "client_id"?: string,"confirmed_at"?: string | null,"confirmed_by"?: string | null,"created_at"?: string,"created_by"?: string,"id"?: string,"slot_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "holds_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "holds_confirmed_by_fkey"
      columns: ["confirmed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "holds_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "holds_slot_id_fkey"
      columns: ["slot_id"]
isOneToOne: false
      referencedRelation: "slot_board"
      referencedColumns: ["slot_id"]
    },{
      foreignKeyName: "holds_slot_id_fkey"
      columns: ["slot_id"]
isOneToOne: false
      referencedRelation: "slots"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"email": string | null,"full_name": string | null,"id": string,"role": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email"?: string | null,"full_name"?: string | null,"id": string,"role"?: string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string | null,"full_name"?: string | null,"id"?: string,"role"?: string
                  }
                  Relationships: [
                    
                  ]
                },"slots": {
                  Row: {
                    "ends_at": string,"id": string,"starts_at": string,"therapist_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ends_at": string,"id"?: string,"starts_at": string,"therapist_id": string
                  }
                  Update: {
                    "ends_at"?: string,"id"?: string,"starts_at"?: string,"therapist_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "slots_therapist_id_fkey"
      columns: ["therapist_id"]
isOneToOne: false
      referencedRelation: "therapists"
      referencedColumns: ["id"]
    }
                  ]
                },"therapists": {
                  Row: {
                    "email": string,"full_name": string,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "email": string,"full_name": string,"id"?: string
                  }
                  Update: {
                    "email"?: string,"full_name"?: string,"id"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "hold_list": {
                  Row: {
                    "client_id": string | null,"client_name": string | null,"confirmed_at": string | null,"created_at": string | null,"ends_at": string | null,"held_until": string | null,"hold_id": string | null,"slot_id": string | null,"starts_at": string | null,"status": string | null,"therapist_id": string | null,"therapist_name": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "holds_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "holds_slot_id_fkey"
      columns: ["slot_id"]
isOneToOne: false
      referencedRelation: "slot_board"
      referencedColumns: ["slot_id"]
    },{
      foreignKeyName: "holds_slot_id_fkey"
      columns: ["slot_id"]
isOneToOne: false
      referencedRelation: "slots"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "slots_therapist_id_fkey"
      columns: ["therapist_id"]
isOneToOne: false
      referencedRelation: "therapists"
      referencedColumns: ["id"]
    }
                  ]
                },"slot_board": {
                  Row: {
                    "client_id": string | null,"client_name": string | null,"ends_at": string | null,"held_until": string | null,"hold_id": string | null,"holdable": boolean | null,"slot_id": string | null,"starts_at": string | null,"status": string | null,"therapist_id": string | null,"therapist_name": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "holds_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "slots_therapist_id_fkey"
      columns: ["therapist_id"]
isOneToOne: false
      referencedRelation: "therapists"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "confirm_hold":
{ Args: { "p_hold_id": string }; Returns: undefined
                           },
"day_slots":
{ Args: { "p_day": string,"p_therapist_id": string }; Returns: {
              "client_id": string | null,
"client_name": string | null,
"ends_at": string | null,
"held_until": string | null,
"hold_id": string | null,
"holdable": boolean | null,
"slot_id": string | null,
"starts_at": string | null,
"status": string | null,
"therapist_id": string | null,
"therapist_name": string | null
            }[]
                          SetofOptions: {
        from: "*"
        to: "slot_board"
        isOneToOne: false
        isSetofReturn: true
      } },
"hold_slot":
{ Args: { "p_client_id": string,"p_slot_id": string }; Returns: string
                           },
"slots_between":
{ Args: { "p_from": string,"p_therapist_id": string,"p_to": string }; Returns: {
              "client_id": string | null,
"client_name": string | null,
"ends_at": string | null,
"held_until": string | null,
"hold_id": string | null,
"holdable": boolean | null,
"slot_id": string | null,
"starts_at": string | null,
"status": string | null,
"therapist_id": string | null,
"therapist_name": string | null
            }[]
                          SetofOptions: {
        from: "*"
        to: "slot_board"
        isOneToOne: false
        isSetofReturn: true
      } }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
