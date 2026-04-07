export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    CompositeTypes: Record<string, never>;
    Enums: Record<string, never>;
    Functions: Record<string, never>;
    Tables: {
      employees: {
        Row: {
          created_at: string;
          department: string | null;
          employee_email: string | null;
          employee_external_id: string | null;
          employee_name: string;
          id: string;
          job_title: string | null;
          manager_id: string | null;
          normalized_name: string;
          updated_at: string;
          work_location: string | null;
        };
        Insert: {
          created_at?: string;
          department?: string | null;
          employee_email?: string | null;
          employee_external_id?: string | null;
          employee_name: string;
          id?: string;
          job_title?: string | null;
          manager_id?: string | null;
          normalized_name: string;
          updated_at?: string;
          work_location?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["employees"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "employees_manager_id_fkey";
            columns: ["manager_id"];
            referencedRelation: "managers";
            referencedColumns: ["id"];
          },
        ];
      };
      imports: {
        Row: {
          id: string;
          import_kind: "offboarding" | "turnover_report";
          imported_at: string;
          metadata: Json;
          notes: string | null;
          row_count: number;
          source_name: string;
          status: "success" | "warning" | "failed";
          storage_path: string | null;
        };
        Insert: {
          id?: string;
          import_kind: "offboarding" | "turnover_report";
          imported_at?: string;
          metadata?: Json;
          notes?: string | null;
          row_count?: number;
          source_name: string;
          status: "success" | "warning" | "failed";
          storage_path?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["imports"]["Insert"]>;
        Relationships: [];
      };
      managers: {
        Row: {
          created_at: string;
          id: string;
          manager_name: string;
          normalized_name: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          manager_name: string;
          normalized_name: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["managers"]["Insert"]>;
        Relationships: [];
      };
      termination_events: {
        Row: {
          created_at: string;
          employee_id: string | null;
          employee_name: string;
          id: string;
          import_id: string;
          manager_id: string | null;
          manager_name: string;
          source_row: Json;
          termination_date: string | null;
          termination_reason: string | null;
          termination_type: "Voluntary" | "Involuntary" | "Unknown";
        };
        Insert: {
          created_at?: string;
          employee_id?: string | null;
          employee_name: string;
          id?: string;
          import_id: string;
          manager_id?: string | null;
          manager_name: string;
          source_row?: Json;
          termination_date?: string | null;
          termination_reason?: string | null;
          termination_type: "Voluntary" | "Involuntary" | "Unknown";
        };
        Update: Partial<Database["public"]["Tables"]["termination_events"]["Insert"]>;
        Relationships: [];
      };
      turnover_report_rows: {
        Row: {
          created_at: string;
          employee_external_id: string | null;
          first_name: string | null;
          id: string;
          import_id: string;
          last_name: string | null;
          report_year: number;
          service_length_years: number | null;
          termination_date: string | null;
          termination_reason: string | null;
          username: string | null;
        };
        Insert: {
          created_at?: string;
          employee_external_id?: string | null;
          first_name?: string | null;
          id?: string;
          import_id: string;
          last_name?: string | null;
          report_year: number;
          service_length_years?: number | null;
          termination_date?: string | null;
          termination_reason?: string | null;
          username?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["turnover_report_rows"]["Insert"]>;
        Relationships: [];
      };
      turnover_summaries: {
        Row: {
          average_active_headcount: number;
          created_at: string;
          generated_at: string | null;
          id: string;
          import_id: string;
          notes: string | null;
          period_end: string;
          period_start: string;
          report_year: number;
          source_name: string;
          terminated_count: number;
          turnover_rate: number;
        };
        Insert: {
          average_active_headcount: number;
          created_at?: string;
          generated_at?: string | null;
          id?: string;
          import_id: string;
          notes?: string | null;
          period_end: string;
          period_start: string;
          report_year: number;
          source_name: string;
          terminated_count: number;
          turnover_rate: number;
        };
        Update: Partial<Database["public"]["Tables"]["turnover_summaries"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
  };
};
