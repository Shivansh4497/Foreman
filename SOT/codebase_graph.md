# Foreman Codebase Architecture

This document visualizes the physical structure of the codebase mapped to its corresponding application boundaries, routing, and database schema representations.

## Physical Codebase Map

```mermaid
graph LR
    classDef root fill:#1A1916,stroke:#D4CFC6,stroke-width:1px,color:#FFFFFF;
    classDef dir fill:#F7F6F3,stroke:#D4CFC6,stroke-width:1px,color:#1A1916;
    classDef page fill:#FFFFFF,stroke:#C5D4F0,stroke-width:1.5px,color:#2E5BBA;
    classDef api fill:#EEF2FB,stroke:#4A73CC,stroke-width:1.5px,color:#1A1916;
    classDef comp fill:#F0EEE9,stroke:#D4CFC6,stroke-width:1px,color:#4A4845;
    classDef lib fill:#EAF5EE,stroke:#1A7A4A,stroke-width:1.5px,color:#1A1916;
    classDef prompt fill:#FEF3DC,stroke:#8A5C00,stroke-width:1px,color:#1A1916;

    Root((Foreman)):::root
    
    %% App Router
    App[src/app]:::dir
    Root --> App
    
    App_Pages[Pages]:::dir
    App --> App_Pages
    App_Pages --> Page_SignIn[signin/page.tsx]:::page
    App_Pages --> Page_On[onboarding/page.tsx]:::page
    App_Pages --> Page_Dash[dashboard/page.tsx]:::page
    App_Pages --> Page_Create[create/page.tsx]:::page
    App_Pages --> Page_Review[review/page.tsx]:::page

    App_API[API Routes]:::dir
    App --> App_API
    App_API --> API_Auth[auth/callback]:::api
    App_API --> API_Keys[api/keys/save]:::api

    API_Scout[api/scout]:::dir
    App_API --> API_Scout
    API_Scout --> API_S_Start[start]:::api
    API_Scout --> API_S_Msg[message]:::api
    API_Scout --> API_S_Blue[blueprint]:::api
    API_Scout --> API_S_Step[step]:::api
    API_Scout --> API_S_Hire[hire]:::api

    %% Components
    Comp[src/components]:::dir
    Root --> Comp
    Comp --> C_Auth[AuthGuard.tsx]:::comp
    Comp --> C_Side[Sidebar.tsx]:::comp
    Comp --> C_Nav[TopNav.tsx]:::comp
    Comp --> C_Scout[scout/]:::comp
    Comp --> C_Set[settings/]:::comp

    %% Lib
    Lib[src/lib]:::dir
    Root --> Lib
    Lib --> L_Supa[supabase.ts]:::lib
    Lib --> L_LLM[llm.ts]:::lib
    
    Lib_Scout[scout/prompts]:::dir
    Lib --> Lib_Scout
    Lib_Scout --> P_L1[layer1_intent...]:::prompt
    Lib_Scout --> P_L2[layer2_questions...]:::prompt
    Lib_Scout --> P_L3[layer3_blueprint...]:::prompt
    Lib_Scout --> P_L4[layer4_context...]:::prompt
    Lib_Scout --> P_L5[layer5_quality...]:::prompt
```

## Database Schema Model (supabase/migrations)

```mermaid
erDiagram
    USERS ||--o{ USER_LLM_CONFIG : configures
    USERS ||--o{ AGENTS : owns
    
    AGENTS ||--o{ AGENT_STEPS : contains
    AGENTS ||--o{ CONVERSATIONS : interacts_via
    AGENTS ||--o{ AGENT_RUNS : executes
    
    AGENT_RUNS ||--o{ CHECKPOINTS : suspends_at

    USERS {
        uuid id PK
        string email
    }
    
    USER_LLM_CONFIG {
        uuid user_id PK,FK
        string provider
        string model
        uuid vault_secret_id FK
    }
    
    AGENTS {
        uuid id PK
        uuid user_id FK
        string name
        string status "draft | active | paused"
        jsonb memory "Layer 2/3 Store"
        jsonb schedule
    }
    
    AGENT_STEPS {
        uuid id PK
        uuid agent_id FK
        int order_num
        string step_type "automated | manual"
        string objective
        string output_format
        string quality_rules
    }
    
    CONVERSATIONS {
        uuid id PK
        uuid agent_id FK
        jsonb messages
    }
    
    AGENT_RUNS {
        uuid id PK
        uuid agent_id FK
        string status "running | completed | failed | waiting"
        int current_step
        jsonb global_state "Run state & outputs"
        int input_tokens
        int output_tokens
    }
```
