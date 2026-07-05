# Deploying to Cloud Run

Two Cloud Run services get deployed from the same container image:

| Service | Manifest | Purpose |
|---|---|---|
| `fake-store-api` | [`cloud-run/service.yaml`](../cloud-run/service.yaml) | The main Express app (public REST API + `/chat`), with `db` (Mongo) and `datadog-agent` as sidecar containers in the same revision. |
| `fake-store-mcp` | [`cloud-run/mcp-service.yaml`](../cloud-run/mcp-service.yaml) | The MCP server (`mcp/http-server.js`), with its own `db` sidecar. Exists as a separate service because Cloud Run only exposes one container per service to the internet - the main app is already that container in `fake-store-api`, so the MCP server needs its own URL to hand to Agent Studio. |

## What `cloud-run/service.yaml` actually is

It's a Knative-style declarative manifest - the Cloud Run equivalent of `docker-compose.yml`, but for one Cloud Run service and its sidecar containers. `gcloud run services replace <file>` reads it and creates or updates the service to match exactly what's in the file (as opposed to `gcloud run deploy`, which is a simpler command-line-flags-only path that doesn't support multi-container sidecars). Both `service.yaml` and `mcp-service.yaml` use the same container image - built once from the repo's `Dockerfile` - and just override the container's `command` to pick which process runs (the Express app vs. `mcp/http-server.js`).

**Region: `us-west1`** - that's where the Agent Studio agents are deployed, so both services below deploy there too rather than the `us-central1` used in earlier drafts of this doc.

## Two ways to run the same deploy

Both do the same thing (build the image once, apply both service YAMLs, grant public access to both) - pick based on where you'd rather run it:

| | [`cloud-run/deploy.sh`](../cloud-run/deploy.sh) | [`cloudbuild.yaml`](../cloudbuild.yaml) |
|---|---|---|
| Runs from | Your local shell (needs `gcloud` installed/authenticated locally) | Cloud Build, submitted from anywhere `gcloud` is available |
| Reusable as a Cloud Build trigger later | No | Yes - a trigger just points at this same file |

You asked specifically about connecting the repo through Cloud Build's GitHub trigger (the "continuously deploy from a repository" option Cloud Run's console offers when creating a service). **Don't use that one-click flow for this project** - see the postmortem below for exactly what goes wrong when you do. `cloudbuild.yaml` is the right building block for a trigger *later* - a trigger just needs to be configured to run this file instead of relying on the console's auto-detected single-container deploy.

## Env vars, not Secret Manager

Both manifests use plain literal `env:` values, not Secret Manager `secretKeyRef`s - a deliberate simplification for this demo. `ANTHROPIC_API_KEY` and `DD_API_KEY` are left blank in the committed YAML; fill in real values either by editing the files before deploying, or afterward:
```
gcloud run services update fake-store-api --region=us-west1 --update-env-vars=ANTHROPIC_API_KEY=...
gcloud run services update fake-store-api --region=us-west1 --update-env-vars=DD_API_KEY=...
gcloud run services update fake-store-mcp --region=us-west1 --update-env-vars=ANTHROPIC_API_KEY=...
```

**Important:** `DATABASE_URL` in both manifests is a single, fully-composed literal (`mongodb://root:example@localhost:27017/fake_store?authSource=admin`), not built from separate `DB_USERNAME`/`DB_PASSWORD`/`DB_HOST` parts like `.env` does. Cloud Run env vars are **not shell-expanded** - if you paste `.env`'s `DATABASE_URL` (which contains literal `$DB_USERNAME` etc., meant to be expanded by `dotenv-expand` or docker-compose's `env_file` loading) directly into a Cloud Run env var, it stays literal and Mongo will fail to resolve a host named `$DB_HOST`. See the postmortem below - this is exactly what happened on the first manual attempt.

## Prerequisites

1. `gcloud auth login` and `gcloud config set project <your-project>` (`deploy.sh` also accepts `PROJECT_ID=` directly, without relying on the active gcloud config).
2. Enable the required APIs: `run`, `artifactregistry`, `cloudbuild` (`deploy.sh` does this for you; running `cloudbuild.yaml` directly assumes it's already done).
3. Create an Artifact Registry Docker repo named `fake-store-api` in your chosen region (`deploy.sh` creates it if missing; `cloudbuild.yaml` assumes it exists).
4. IAM - who needs what depends on which path you use:
   - **`deploy.sh`** (runs as you, locally): your own account needs to enable APIs, push to Artifact Registry, run Cloud Build, deploy Cloud Run services, and manage IAM policy bindings on them - Owner/Editor on the project covers all of this.
   - **`cloudbuild.yaml`** (runs as Cloud Build's own service account, `PROJECT_NUMBER@cloudbuild.gserviceaccount.com`): that service account needs `roles/run.admin`, `roles/iam.serviceAccountUser`, and `roles/artifactregistry.writer`. Your own account just needs permission to submit the build (`roles/cloudbuild.builds.editor` or broader).

## Deploy

Locally with `deploy.sh`:
```
PROJECT_ID=your-project REGION=us-west1 ./cloud-run/deploy.sh
```

Or via Cloud Build directly:
```
gcloud builds submit --config=cloudbuild.yaml --substitutions=_REGION=us-west1,_REPO=fake-store-api
```

Either way: it builds the image, deploys both services, grants public unauthenticated access to both (`fake-store-api` because it's a public demo REST API like the upstream fakestoreapi.com; `fake-store-mcp` because Agent Studio's MCP connector only supports unauthenticated servers - see `docs/agent-studio-setup.md`). `deploy.sh` prints both URLs at the end; with `cloudbuild.yaml`, get them afterward with `gcloud run services describe fake-store-mcp --region=us-west1 --format='value(status.url)'` (and likewise for `fake-store-api`). Take the MCP URL, add `/mcp`, and use that as the Endpoint URL when connecting each specialist subagent's MCP tool in Agent Studio.

## Postmortem: what went wrong on the first manual attempt

The first deploy used Cloud Run's console "deploy from source" / "continuously deploy from a repository" flow instead of the files above. Two things went wrong as a direct result, both worth understanding since the same console flow is easy to reach for again:

1. **Single container, no sidecars, no env vars at all.** That flow does its own `gcloud run deploy` from an auto-detected Dockerfile build - it has no awareness of `cloud-run/service.yaml`'s multi-container spec, so it deployed just the `app` container alone, with zero env vars set. `DATABASE_URL` was `undefined`, so `mongoose.connect()` threw synchronously and the process exited before ever calling `app.listen()` - which is why Cloud Run's startup probe timed out ("container failed to start and listen on the port").
2. **After manually adding env vars via the console** (copy-pasting values out of `.env`), the app still couldn't reach Mongo - because `.env`'s `DATABASE_URL` contains literal `$DB_USERNAME`/`$DB_PASSWORD`/`$DB_HOST` references that only get expanded by `dotenv-expand` (when a real `.env` file is present on disk, which it isn't in any container image - see `.dockerignore`) or by docker-compose's `env_file` loading (which *does* expand them, confirmed by testing). Cloud Run's console env var editor does neither, so `DATABASE_URL` ended up literally containing `$DB_HOST` as text, which isn't a resolvable hostname.
3. **That console flow also silently created a standing Cloud Build trigger** watching the repo, which will keep re-running its own broken single-container deploy on every future push - fighting with any deploy done via `cloudbuild.yaml`. Delete it (`gcloud builds triggers list` / `gcloud builds triggers delete`) before relying on `cloudbuild.yaml` or `deploy.sh` going forward.

## The Mongo caveat, concretely

Both services get their **own, separate, ephemeral** `db` sidecar (per `docs/agent-studio-setup.md`'s existing note) - they are not sharing data. That's fine to get the MCP endpoint live and reachable, but it means:

- Seed test data into `fake-store-mcp`'s Mongo for the Agent Studio demo to have anything to show (`get_cart`/`get_product`/`get_user` will return empty otherwise).
- If you also want the `/chat` endpoint on `fake-store-api` to see the *same* data as Agent Studio's agents, that requires moving both services onto one shared, externally-reachable Mongo (MongoDB Atlas is the lowest-effort option) instead of each having its own sidecar - a real architecture change, not something this script does for you.
