# Services

**Infrastructure services - API, database, sync, cache**

This folder contains all external service integrations and infrastructure concerns:

## Database Services (`database/`)

- **IndexedDB** (`indexedDB.ts`) - Local browser database wrapper
- **Client setup** (`client.ts`) - Database connection configuration

## Supabase Services (`supabase/`)

Split from monolithic `SupabaseService.ts` into domain-specific services:

- **AuthService** - User authentication and session management
- **GoalsService** - Goal CRUD operations
- **EventsService** - Calendar event management
- **BrainDumpService** - Brain dump entry storage
- **AnalyticsService** - User analytics tracking
- **PreferencesService** - User preference storage
- **BatchOperations** - Bulk data operations

## Sync Services (`sync/`)

- **SyncQueue** - Offline change queuing
- **BatchSaveService** - Periodic data synchronization
- **DirtyTracker** - Change tracking for sync optimization
- **syncHelpers** - Debounce/throttle utilities for cloud sync

## Cache Services (`cache/`)

- **CacheService** - Application data caching
- **cacheWarmup** - Cache initialization and preloading

## PWA Services (`pwa/`)

- **IosFixesService** (`IosFixesService.ts`) - iOS Safari PWA compatibility
- **service-worker** (`service-worker.js`) - PWA service worker

## General Services

- **errors** (`errors.ts`) - Centralized error handling

## Principles

- **Single responsibility**: Each service handles one concern
- **Async operations**: All external calls return Promises
- **Error handling**: Proper error propagation and logging
- **Testable**: Mock external dependencies for unit testing

## Usage

```typescript
import { goalsService } from "./supabase";
import { syncQueue } from "./sync";

// Service calls are async
const goals = await goalsService.getGoals(userId);
await syncQueue.enqueue({ type: "update", entity: "goal", data: goal });
```

## Architecture

Services follow the **facade pattern** with backward compatibility:

```typescript
// New modular approach
import { goalsService } from "./supabase";

// Legacy compatibility (deprecated)
import { SupabaseService } from "./SupabaseService";
```

## Dependencies

- Can import from: `types`, `config`, `core`, `utils`
- Should handle: Network failures, offline states, authentication errors
