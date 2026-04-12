# Foreman System Architecture

This document provides a visualization of the Foreman system architecture, mapping out the relationships between the frontend, backend, third-party services, and the core agent orchestration engine (Scout).

## High-Level System Architecture

```mermaid
graph TD
    classDef frontend fill:#EAF5EE,stroke:#1A7A4A,stroke-width:2px,color:#1A1916;
    classDef backend fill:#EEF2FB,stroke:#2E5BBA,stroke-width:2px,color:#1A1916;
    classDef thirdparty fill:#F0EEE9,stroke:#D4CFC6,stroke-width:2px,color:#1A1916;
    classDef db fill:#FEF3DC,stroke:#8A5C00,stroke-width:2px,color:#1A1916;

    subgraph Client ["Client Layer"]
        B[Browser / UI]:::frontend
    end

    subgraph Infrastructure ["Supabase (Backend Layer)"]
        A[Next.js App Router]:::frontend
        DB[(PostgreSQL)]:::db
        Auth[Supabase Auth]:::backend
        Vault[Supabase Vault]:::backend
    end

    subgraph Execution ["Background Processing"]
        TD[Trigger.dev Worker]:::backend
    end

    subgraph External ["External Services"]
        LLM[LLM Providers<br>OpenAI/Anthropic/Gemini/Groq]:::thirdparty
        Tav[Tavily API]:::thirdparty
        Res[Resend]:::thirdparty
        OAuth[Google OAuth]:::thirdparty
    end

    B <-->|Polling State| A
    B -.->|Sign In| OAuth
    OAuth -.-> Auth
    A -->|API routes / SSR| DB
    A -->|Auth| Auth
    A -->|Enqueues Job| TD
    
    TD -->|Reads/Writes State| DB
    TD -->|Decrypts key| Vault
    Vault -->|Yields Key| TD
    TD -->|Prompt / Chat| LLM
    TD -->|Search| Tav
    TD -->|Checkpoint Alert| Res

    %% Connections to DB
    Auth --> DB
```

## Scout Agent Creation Pipeline (5-Layer Architecture)

```mermaid
flowchart TD
    classDef user fill:#F0EEE9,stroke:#7A7770,stroke-width:2px,color:#1A1916;
    classDef layer fill:#EEF2FB,stroke:#2E5BBA,stroke-width:2px,color:#1A1916;
    classDef artifact fill:#EAF5EE,stroke:#1A7A4A,stroke-width:2px,color:#1A1916;
    classDef check fill:#FEF3DC,stroke:#8A5C00,stroke-width:2px,color:#1A1916;

    User([User Prompt]):::user -->|What should this agent do?| L1

    subgraph ScoutEngine [Scout Intelligence Pipeline]
        L1[Layer 1: Intent Classification]:::layer -->|Task Category Selected| L2
        L2[Layer 2: Minimum Question Bank]:::layer -->|Ask Missing Info| User
        L2 -->|All info gathered| L3
        L3[Layer 3: Workflow Templates]:::layer --> L4
        L4[Layer 4: Context Injection]:::layer --> L5
        L5{Layer 5: Quality Gate}:::check
        L5 -->|Fails Validation| L3
    end

    L5 -->|Passes| Draft[Workforce Blueprint UI]:::artifact
    Draft -->|Review & Hire| Active[Active Agent]:::artifact
```

## Execution Engine & Memory Flow

```mermaid
flowchart LR
    classDef state fill:#EEF2FB,stroke:#2E5BBA,stroke-width:2px,color:#1A1916;
    classDef step fill:#F7F6F3,stroke:#D4CFC6,stroke-width:2px,color:#1A1916;
    classDef check fill:#FEF3DC,stroke:#8A5C00,stroke-width:2px,color:#1A1916;
    classDef memory fill:#EAF5EE,stroke:#1A7A4A,stroke-width:2px,color:#1A1916;

    Trigger([Manual/Cron Trigger]) --> S1
    Global[(Global Run State)]:::state
    PermMem[(Layer 2/3: Permanent Memory)]:::memory
    
    PermMem -.->|Context Loaded| S1
    
    subgraph RunInstance [Agent Run Instance]
        S1[Step 1: Automated]:::step <--> Global
        S1 --> S2
        S2[Step 2: Checkpoint]:::check <--> Global
        S2 -.->|Wait for interaction| UX([User Feedback])
        UX -.->|Update State| S2
        S2 --> S3
        S3[Step 3: Output]:::step <--> Global
    end
    
    UX -.->|Reject Output| PermMem
    S3 -->|Approval| Compound[Update Agent Memory]
    Compound --> PermMem
```
