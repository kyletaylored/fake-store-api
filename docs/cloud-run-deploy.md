# Deploying to Cloud Run

Two Cloud Run services get deployed from the same container image:

| Service | Manifest | Purpose |
|---|---|---|
| `fake-store-api` | [`cloud-run/service.yaml`](../cloud-run/service.yaml) | The main Express app (public REST API + `/chat`), with `db` (Mongo) and `datadog-agent` as sidecar containers in the same revision. |
| `fake-store-mcp` | [`cloud-run/mcp-service.yaml`](../cloud-run/mcp-service.yaml) | The MCP server (`mcp/http-server.js`), with its own `db` sidecar. Exists as a separate service because Cloud Run only exposes one container per service to the internet - the main app is already that container in `fake-store-api`, so the MCP server needs its own URL to hand to Agent Studio. |

## What `cloud-run/service.yaml` actually is

It's a Knative-style declarative manifest - the Cloud Run equivalent of `docker-compose.yml`, but for one Cloud Run service and its sidecar containers. `gcloud run services replace <file>` reads it and creates or updates the service to match exactly what's in the file (as opposed to `gcloud run deploy`, which is a simpler command-line-flags-only path that doesn't support multi-container sidecars). Both `service.yaml` and `mcp-service.yaml` use the same container image - built once from the repo's `Dockerfile` - and just override the container's `command` to pick which process runs (the Express app vs. `mcp/http-server.js`).

## Two ways to run the same deploy

Both do the same thing (build the image once, apply both service YAMLs, grant public access to both) - pick based on where you'd rather run it:

| | [`cloud-run/deploy.sh`](../cloud-run/deploy.sh) | [`cloudbuild.yaml`](../cloudbuild.yaml) |
|---|---|---|
| Runs from | Your local shell (needs `gcloud` installed/authenticated locally) | Cloud Build, submitted from anywhere `gcloud` is available |
| Checks secrets exist first | Yes, fails with clear instructions if any are missing | No - assumes prerequisites are already met (see below) |
| Reusable as a Cloud Build trigger later | No | Yes - a trigger just points at this same file |

You asked specifically about connecting the repo through Cloud Build's GitHub trigger (the "continuously deploy from a repository" option Cloud Run's console offers when creating a service). **Don't use that one-click flow for this project:** it's built around `gcloud run deploy` with a single container - it infers a Dockerfile build and deploys straight to a service, with no path to apply a multi-container Knative YAML like ours. `cloudbuild.yaml` is the right building block for a trigger *later* - a trigger just needs to be configured to run this file instead of relying on the console's auto-detected single-container deploy. Not needed to get this working today; run it manually with `gcloud builds submit --config=cloudbuild.yaml` and add the trigger once the demo is stable.

## Prerequisites

1. `gcloud auth login` and `gcloud config set project <your-project>` (`deploy.sh` also accepts `PROJECT_ID=` directly, without relying on the active gcloud config).
2. Enable the required APIs: `run`, `artifactregistry`, `secretmanager`, `cloudbuild` (`deploy.sh` does this for you; running `cloudbuild.yaml` directly assumes it's already done).
3. Create an Artifact Registry Docker repo named `fake-store-api` in your chosen region (`deploy.sh` creates it if missing; `cloudbuild.yaml` assumes it exists).
4. Create the secrets referenced by both manifests - neither path guesses values for you:
   ```
   gcloud secrets create jwt-secret       --data-file=- <<< "<a real random secret>"
   gcloud secrets create db-password      --data-file=- <<< "<a real password>"
   gcloud secrets create database-url     --data-file=- <<< "mongodb://root:<that same password>@localhost:27017/fake_store?authSource=admin"
   gcloud secrets create dd-api-key       --data-file=- <<< "<your Datadog API key>"
   gcloud secrets create anthropic-api-key --data-file=- <<< "<your Anthropic API key>"
   ```
5. IAM - who needs what depends on which path you use:
   - **`deploy.sh`** (runs as you, locally): your own account needs to enable APIs, push to Artifact Registry, run Cloud Build, deploy Cloud Run services, and manage IAM policy bindings on them - Owner/Editor on the project covers all of this.
   - **`cloudbuild.yaml`** (runs as Cloud Build's own service account, `PROJECT_NUMBER@cloudbuild.gserviceaccount.com`): that service account needs `roles/run.admin`, `roles/iam.serviceAccountUser`, and `roles/artifactregistry.writer`. Your own account just needs permission to submit the build (`roles/cloudbuild.builds.editor` or broader).
   - Separately, at runtime, each Cloud Run service's own service account needs `roles/secretmanager.secretAccessor` on the secrets it references - that's a Cloud Run concern, not a Cloud Build one.

## Deploy

Locally with `deploy.sh`:
```
PROJECT_ID=your-project REGION=us-central1 ./cloud-run/deploy.sh
```

Or via Cloud Build directly:
```
gcloud builds submit --config=cloudbuild.yaml --substitutions=_REGION=us-central1,_REPO=fake-store-api
```

Either way: it builds the image, deploys both services, grants public unauthenticated access to both (`fake-store-api` because it's a public demo REST API like the upstream fakestoreapi.com; `fake-store-mcp` because Agent Studio's MCP connector only supports unauthenticated servers - see `docs/agent-studio-setup.md`). `deploy.sh` prints both URLs at the end; with `cloudbuild.yaml`, get them afterward with `gcloud run services describe fake-store-mcp --region=<region> --format='value(status.url)'` (and likewise for `fake-store-api`). Take the MCP URL, add `/mcp`, and use that as the Endpoint URL when connecting each specialist subagent's MCP tool in Agent Studio.

## The Mongo caveat, concretely

Both services get their **own, separate, ephemeral** `db` sidecar (per `docs/agent-studio-setup.md`'s existing note) - they are not sharing data. That's fine to get the MCP endpoint live and reachable, but it means:

- Seed test data into `fake-store-mcp`'s Mongo for the Agent Studio demo to have anything to show (`get_cart`/`get_product`/`get_user` will return empty otherwise).
- If you also want the `/chat` endpoint on `fake-store-api` to see the *same* data as Agent Studio's agents, that requires moving both services onto one shared, externally-reachable Mongo (MongoDB Atlas is the lowest-effort option) instead of each having its own sidecar - a real architecture change, not something this script does for you.
