# Deploying to Cloud Run

Two Cloud Run services get deployed from the same container image:

| Service | Manifest | Purpose |
|---|---|---|
| `fake-store-api` | [`cloud-run/service.yaml`](../cloud-run/service.yaml) | The main Express app (public REST API + `/chat`), with `db` (Mongo) and `datadog-agent` as sidecar containers in the same revision. |
| `fake-store-mcp` | [`cloud-run/mcp-service.yaml`](../cloud-run/mcp-service.yaml) | The MCP server (`mcp/http-server.js`), with its own `db` sidecar. Exists as a separate service because Cloud Run only exposes one container per service to the internet - the main app is already that container in `fake-store-api`, so the MCP server needs its own URL to hand to Agent Studio. |

## What `cloud-run/service.yaml` actually is

It's a Knative-style declarative manifest - the Cloud Run equivalent of `docker-compose.yml`, but for one Cloud Run service and its sidecar containers. `gcloud run services replace <file>` reads it and creates or updates the service to match exactly what's in the file (as opposed to `gcloud run deploy`, which is a simpler command-line-flags-only path that doesn't support multi-container sidecars). Both `service.yaml` and `mcp-service.yaml` use the same container image - built once from the repo's `Dockerfile` - and just override the container's `command` to pick which process runs (the Express app vs. `mcp/http-server.js`).

## Recommended: deploy manually for now, not via a Cloud Build repo trigger

You asked specifically about connecting the repo through Cloud Build's GitHub trigger (the "continuously deploy from a repository" option Cloud Run's console offers when creating a service). **Don't use that for this project, at least not yet:**

- That one-click flow is built around `gcloud run deploy` with a single container - it infers a Dockerfile build and deploys straight to a service, with no path to apply a multi-container Knative YAML like ours. Wiring it up for two sidecar-based services would mean fighting the flow, not using it.
- The actual "run this YAML" step (`gcloud run services replace`) is what we need, and Cloud Build triggers run whatever's in a `cloudbuild.yaml` you author - a repo connection just gives you automatic *triggering*, it doesn't change what commands actually run.

**Recommendation:** deploy manually via [`cloud-run/deploy.sh`](../cloud-run/deploy.sh) while this is a demo you're actively iterating on. It builds the image once (via a one-off `gcloud builds submit` - this uses Cloud Build too, just without a standing trigger) and applies both service YAMLs. This gets you redeploying in one command without any GitHub App connection, trigger config, or Cloud Build service account IAM to set up first.

**If you want automatic redeploy-on-push later:** set up a Cloud Build trigger connected to the repo, but give it a custom `cloudbuild.yaml` with explicit steps (`gcloud builds submit` equivalent build step, then two `gcloud run services replace` steps) instead of relying on the trigger's auto-detected single-container deploy. That's a reasonable next step once the demo is stable - not needed to get this working today.

## Prerequisites

1. `gcloud auth login` and `gcloud config set project <your-project>` (or just pass `PROJECT_ID=` to the script - it doesn't rely on the active gcloud config).
2. Create the secrets referenced by both manifests (the script checks these exist and tells you which are missing rather than guessing values for you):
   ```
   gcloud secrets create jwt-secret       --data-file=- <<< "<a real random secret>"
   gcloud secrets create db-password      --data-file=- <<< "<a real password>"
   gcloud secrets create database-url     --data-file=- <<< "mongodb://root:<that same password>@localhost:27017/fake_store?authSource=admin"
   gcloud secrets create dd-api-key       --data-file=- <<< "<your Datadog API key>"
   gcloud secrets create anthropic-api-key --data-file=- <<< "<your Anthropic API key>"
   ```
3. Your account needs permission to enable APIs, push to Artifact Registry, run Cloud Build, deploy Cloud Run services, and manage IAM policy bindings on them - Owner/Editor on the project covers all of this; ask whoever administers the project if you're on a more restricted role.

## Deploy

```
PROJECT_ID=your-project REGION=us-central1 ./cloud-run/deploy.sh
```

This builds the image, deploys both services, grants public unauthenticated access to both (`fake-store-api` because it's a public demo REST API like the upstream fakestoreapi.com; `fake-store-mcp` because Agent Studio's MCP connector only supports unauthenticated servers - see `docs/agent-studio-setup.md`), and prints both URLs at the end. Take the printed MCP URL, add `/mcp`, and use that as the Endpoint URL when connecting each specialist subagent's MCP tool in Agent Studio.

## The Mongo caveat, concretely

Both services get their **own, separate, ephemeral** `db` sidecar (per `docs/agent-studio-setup.md`'s existing note) - they are not sharing data. That's fine to get the MCP endpoint live and reachable, but it means:

- Seed test data into `fake-store-mcp`'s Mongo for the Agent Studio demo to have anything to show (`get_cart`/`get_product`/`get_user` will return empty otherwise).
- If you also want the `/chat` endpoint on `fake-store-api` to see the *same* data as Agent Studio's agents, that requires moving both services onto one shared, externally-reachable Mongo (MongoDB Atlas is the lowest-effort option) instead of each having its own sidecar - a real architecture change, not something this script does for you.
