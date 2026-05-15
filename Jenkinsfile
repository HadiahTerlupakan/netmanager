// Jenkinsfile (Controller Isolation / Kubernetes Pod version)
pipeline {
    options {
        disableConcurrentBuilds()
    }
    agent {
        kubernetes {
            yaml """
apiVersion: v1
kind: Pod
metadata:
  labels:
    some-label: jenkins-pipeline
spec:
  containers:
  - name: jnlp
    image: jenkins/inbound-agent:3355.v388858a_47b_33-17-rhel-ubi9-jdk21
    imagePullPolicy: IfNotPresent
  - name: node
    image: node:24.15.0-alpine3.23
    imagePullPolicy: IfNotPresent
    command: ['cat']
    tty: true
  - name: docker
    image: docker:29.4.0-cli-alpine3.23
    imagePullPolicy: IfNotPresent
    command: ['cat']
    tty: true
    volumeMounts:
    - name: docker-sock
      mountPath: /var/run/docker.sock
  - name: kubectl
    image: dtzar/helm-kubectl:4.1.3
    imagePullPolicy: IfNotPresent
    command: ['cat']
    tty: true
  volumes:
  - name: docker-sock
    hostPath:
      path: /var/run/docker.sock
"""
        }
    }

    parameters {
        choice(name: 'DEPLOY_MODE', choices: ['normal', 'recovery'], description: 'normal = build+deploy biasa, recovery = deploy known-good image tanpa build baru')
        string(name: 'RECOVERY_APP_IMAGE', defaultValue: '', description: 'Immutable image ref app untuk recovery production')
        string(name: 'RECOVERY_CRON_IMAGE', defaultValue: '', description: 'Immutable image ref cron untuk recovery production')
        string(name: 'RECOVERY_RADIUS_IMAGE', defaultValue: '', description: 'Immutable image ref radius untuk recovery production')
    }

    environment {
        DOCKER_IMAGE = "netmanager-app"
        CRON_IMAGE = "netmanager-cron"
        RADIUS_IMAGE = "netmanager-radius"
        DOCKER_BUILDKIT = "1"
        DOCKER_TAG = "${env.BRANCH_NAME == 'main' || env.GIT_BRANCH == 'origin/main' || env.GIT_BRANCH == 'main' ? 'production' : 'staging'}"
        IMAGE_VERSION = "${((env.GIT_COMMIT ?: 'nogit').take(12))}-${env.BUILD_NUMBER ?: '0'}"
        IMAGE_REVISION = "${env.GIT_COMMIT ?: "unknown"}"
        NAMESPACE = "${env.BRANCH_NAME == 'main' || env.GIT_BRANCH == 'origin/main' || env.GIT_BRANCH == 'main' ? 'netmanager-production' : 'netmanager-staging'}"
        K8S_DIR = "${env.BRANCH_NAME == 'main' || env.GIT_BRANCH == 'origin/main' || env.GIT_BRANCH == 'main' ? 'k8s/production' : 'k8s/staging'}"
    }

    stages {
        stage('Validate Registry Configuration') {
            steps {
                script {
                    def normalizeRegistryUrl = { String value ->
                        return (value ?: '')
                            .trim()
                            .replaceFirst(/^https?:\/\//, '')
                            .replaceAll('/+$', '')
                    }

                    def getRuntimeConfig = { String preferredName, String legacyName ->
                        def preferredEnvValue = (env."${preferredName}" ?: '').trim()
                        def legacyEnvValue = (env."${legacyName}" ?: '').trim()
                        def preferredParamValue = "${params[preferredName] ?: ''}".trim()
                        def legacyParamValue = "${params[legacyName] ?: ''}".trim()

                        return preferredEnvValue ?: legacyEnvValue ?: preferredParamValue ?: legacyParamValue
                    }

                    def requireValue = { String value, String message ->
                        if (!value?.trim()) {
                            error(message)
                        }
                    }

                    def envScopedName = { String baseName ->
                        def scope = env.DOCKER_TAG == 'production' ? 'PRODUCTION' : 'STAGING'
                        return "${baseName}_${scope}"
                    }

                    def getEnvScopedRuntimeConfig = { String baseName ->
                        def scopedName = envScopedName(baseName)
                        def scopedValue = (env."${scopedName}" ?: '').trim()
                        if (scopedValue) {
                            return scopedValue
                        }

                        return getRuntimeConfig(scopedName, baseName)
                    }

                    env.REGISTRY_URL = normalizeRegistryUrl(getRuntimeConfig('NETMANAGER_REGISTRY_URL', 'REGISTRY_URL'))
                    env.REGISTRY_NAMESPACE = getRuntimeConfig('NETMANAGER_REGISTRY_NAMESPACE', 'REGISTRY_NAMESPACE')
                    env.REGISTRY_CREDENTIALS_ID = getRuntimeConfig('NETMANAGER_REGISTRY_CREDENTIALS_ID', 'REGISTRY_CREDENTIALS_ID')
                    env.DEPLOY_MODE = "${params.DEPLOY_MODE ?: 'normal'}"
                    env.NEXT_PUBLIC_FIREBASE_API_KEY = getEnvScopedRuntimeConfig('NEXT_PUBLIC_FIREBASE_API_KEY')
                    env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = getEnvScopedRuntimeConfig('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN')
                    env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = getEnvScopedRuntimeConfig('NEXT_PUBLIC_FIREBASE_PROJECT_ID')
                    env.NEXT_PUBLIC_FIREBASE_DATABASE_URL = getEnvScopedRuntimeConfig('NEXT_PUBLIC_FIREBASE_DATABASE_URL')
                    env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = getEnvScopedRuntimeConfig('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET')
                    env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = getEnvScopedRuntimeConfig('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID')
                    env.NEXT_PUBLIC_FIREBASE_APP_ID = getEnvScopedRuntimeConfig('NEXT_PUBLIC_FIREBASE_APP_ID')
                    env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = getEnvScopedRuntimeConfig('NEXT_PUBLIC_VAPID_PUBLIC_KEY')
                    env.FIREBASE_PROJECT_ID = getEnvScopedRuntimeConfig('FIREBASE_PROJECT_ID')
                    env.FIREBASE_CLIENT_EMAIL = getEnvScopedRuntimeConfig('FIREBASE_CLIENT_EMAIL')
                    env.FIREBASE_PRIVATE_KEY = getEnvScopedRuntimeConfig('FIREBASE_PRIVATE_KEY')
                    env.FIREBASE_DATABASE_URL = getEnvScopedRuntimeConfig('FIREBASE_DATABASE_URL')
                    env.FIREBASE_DATABASE_URL = env.FIREBASE_DATABASE_URL?.trim()

                    requireValue(env.REGISTRY_URL, 'NETMANAGER_REGISTRY_URL (atau REGISTRY_URL) wajib disediakan di runtime Jenkins.')
                    requireValue(env.REGISTRY_NAMESPACE, 'NETMANAGER_REGISTRY_NAMESPACE (atau REGISTRY_NAMESPACE) wajib disediakan di runtime Jenkins.')
                    requireValue(env.REGISTRY_CREDENTIALS_ID, 'NETMANAGER_REGISTRY_CREDENTIALS_ID (atau REGISTRY_CREDENTIALS_ID) wajib disediakan di runtime Jenkins.')
                    requireValue(env.NEXT_PUBLIC_FIREBASE_API_KEY, "${envScopedName('NEXT_PUBLIC_FIREBASE_API_KEY')} (atau NEXT_PUBLIC_FIREBASE_API_KEY) wajib disediakan di runtime Jenkins.")
                    requireValue(env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, "${envScopedName('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN')} (atau NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN) wajib disediakan di runtime Jenkins.")
                    requireValue(env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, "${envScopedName('NEXT_PUBLIC_FIREBASE_PROJECT_ID')} (atau NEXT_PUBLIC_FIREBASE_PROJECT_ID) wajib disediakan di runtime Jenkins.")
                    requireValue(env.NEXT_PUBLIC_FIREBASE_DATABASE_URL, "${envScopedName('NEXT_PUBLIC_FIREBASE_DATABASE_URL')} (atau NEXT_PUBLIC_FIREBASE_DATABASE_URL) wajib disediakan di runtime Jenkins.")
                    requireValue(env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, "${envScopedName('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET')} (atau NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) wajib disediakan di runtime Jenkins.")
                    requireValue(env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, "${envScopedName('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID')} (atau NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID) wajib disediakan di runtime Jenkins.")
                    requireValue(env.NEXT_PUBLIC_FIREBASE_APP_ID, "${envScopedName('NEXT_PUBLIC_FIREBASE_APP_ID')} (atau NEXT_PUBLIC_FIREBASE_APP_ID) wajib disediakan di runtime Jenkins.")
                    requireValue(env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, "${envScopedName('NEXT_PUBLIC_VAPID_PUBLIC_KEY')} (atau NEXT_PUBLIC_VAPID_PUBLIC_KEY) wajib disediakan di runtime Jenkins.")
                    requireValue(env.FIREBASE_PROJECT_ID, "${envScopedName('FIREBASE_PROJECT_ID')} (atau FIREBASE_PROJECT_ID) wajib disediakan di runtime Jenkins.")
                    requireValue(env.FIREBASE_CLIENT_EMAIL, "${envScopedName('FIREBASE_CLIENT_EMAIL')} (atau FIREBASE_CLIENT_EMAIL) wajib disediakan di runtime Jenkins.")
                    requireValue(env.FIREBASE_PRIVATE_KEY, "${envScopedName('FIREBASE_PRIVATE_KEY')} (atau FIREBASE_PRIVATE_KEY) wajib disediakan di runtime Jenkins.")

                    env.REGISTRY_PATH = "${env.REGISTRY_URL}/${env.REGISTRY_NAMESPACE}"
                    env.APP_IMAGE_REF = "${env.REGISTRY_PATH}/${env.DOCKER_IMAGE}:${env.IMAGE_VERSION}"
                    env.CRON_IMAGE_REF = "${env.REGISTRY_PATH}/${env.CRON_IMAGE}:${env.IMAGE_VERSION}"
                    env.RADIUS_IMAGE_REF = "${env.REGISTRY_PATH}/${env.RADIUS_IMAGE}:${env.IMAGE_VERSION}"
                    env.APP_IMAGE_ENV_REF = "${env.REGISTRY_PATH}/${env.DOCKER_IMAGE}:${env.DOCKER_TAG}"
                    env.CRON_IMAGE_ENV_REF = "${env.REGISTRY_PATH}/${env.CRON_IMAGE}:${env.DOCKER_TAG}"
                    env.RADIUS_IMAGE_ENV_REF = "${env.REGISTRY_PATH}/${env.RADIUS_IMAGE}:${env.DOCKER_TAG}"
                    env.APP_IMAGE_PREV_REF = "${env.REGISTRY_PATH}/${env.DOCKER_IMAGE}:${env.DOCKER_TAG}-prev"
                    env.CRON_IMAGE_PREV_REF = "${env.REGISTRY_PATH}/${env.CRON_IMAGE}:${env.DOCKER_TAG}-prev"
                    env.RADIUS_IMAGE_PREV_REF = "${env.REGISTRY_PATH}/${env.RADIUS_IMAGE}:${env.DOCKER_TAG}-prev"

                    def resolveDeployImageRef = { String workload, String defaultRef, String recoveryOverride ->
                        def trimmedOverride = (recoveryOverride ?: '').trim()

                        if (env.DEPLOY_MODE != 'recovery') {
                            return defaultRef
                        }

                        requireValue(trimmedOverride, "Recovery mode mewajibkan image override untuk ${workload}.")

                        if (!trimmedOverride.startsWith("${env.REGISTRY_PATH}/")) {
                            error("Recovery image untuk ${workload} harus memakai registry resmi: ${trimmedOverride}")
                        }

                        return trimmedOverride
                    }

                    if (env.DEPLOY_MODE == 'recovery' && env.BRANCH_NAME != 'main') {
                        error('Recovery mode hanya boleh dijalankan untuk branch main.')
                    }

                    env.APP_DEPLOY_REF = resolveDeployImageRef('netmanager-app', env.APP_IMAGE_REF, params.RECOVERY_APP_IMAGE)
                    env.CRON_DEPLOY_REF = resolveDeployImageRef('netmanager-cron', env.CRON_IMAGE_REF, params.RECOVERY_CRON_IMAGE)
                    env.RADIUS_DEPLOY_REF = resolveDeployImageRef('netmanager-radius', env.RADIUS_IMAGE_REF, params.RECOVERY_RADIUS_IMAGE)

                    echo "Registry configured: ${env.REGISTRY_PATH}"
                    echo "Deploy mode: ${env.DEPLOY_MODE}"
                    echo "Immutable refs: ${env.APP_IMAGE_REF}, ${env.CRON_IMAGE_REF}, ${env.RADIUS_IMAGE_REF}"
                    echo "Deploy refs: ${env.APP_DEPLOY_REF}, ${env.CRON_DEPLOY_REF}, ${env.RADIUS_DEPLOY_REF}"
                    echo "Env refs: ${env.APP_IMAGE_ENV_REF}, ${env.CRON_IMAGE_ENV_REF}, ${env.RADIUS_IMAGE_ENV_REF}"
                }
            }
        }

        stage('Install & Code Quality Check') {
            steps {
                container('node') {
                    script {
                        echo "Running Quality Checks inside Node container..."
                        withEnv([
                            'DATABASE_URL=postgresql://user:pass@localhost:5432/db',
                            'RADIUS_DATABASE_URL=postgresql://user:pass@localhost:5432/radius',
                            'DATABASE_URL_BILLING=postgresql://user:pass@localhost:5432/billing',
                            'DATABASE_URL_MITRA=postgresql://user:pass@localhost:5432/mitra',
                            'REDIS_URL=redis://localhost:6379',
                            'NODE_ENV=test',
                            'ENABLE_INTERNAL_CRON=false',
                            'NEXTAUTH_SECRET=ci-build-dummy-secret-at-least-32-chars',
                            'AUTH_SECRET=ci-build-dummy-secret-at-least-32-chars',
                            'NEXTAUTH_URL=http://localhost:3000'
                        ]) {
                            sh """
                                set -euo pipefail
                                npm config set fetch-retries 5
                                npm config set fetch-retry-mintimeout 20000
                                npm config set fetch-retry-maxtimeout 120000
                                npm ci --no-audit --prefer-offline --ignore-scripts
                                npm run prisma:generate-parallel
                                echo "Running Lint and Typecheck in parallel..."
                                npm run lint & LINT_PID=\$!
                                npm run typecheck & TYPE_PID=\$!
                                wait \$LINT_PID \$TYPE_PID
                            """
                        }
                    }
                }
            }
        }

        stage('Run Unit Tests') {
            steps {
                container('node') {
                    script {
                        echo "Running Unit Tests inside Node container..."
                        withEnv([
                            'DATABASE_URL=postgresql://user:pass@localhost:5432/db',
                            'RADIUS_DATABASE_URL=postgresql://user:pass@localhost:5432/radius',
                            'DATABASE_URL_BILLING=postgresql://user:pass@localhost:5432/billing',
                            'DATABASE_URL_MITRA=postgresql://user:pass@localhost:5432/mitra',
                            'REDIS_URL=redis://localhost:6379',
                            'NODE_ENV=test',
                            'ENABLE_INTERNAL_CRON=false',
                            'NEXTAUTH_SECRET=ci-test-dummy-secret-at-least-32-chars',
                            'AUTH_SECRET=ci-test-dummy-secret-at-least-32-chars',
                            'NEXTAUTH_URL=http://localhost:3000'
                        ]) {
                            sh "set -euo pipefail; npm run test:run"
                        }
                    }
                }
            }
        }

        stage('Backup Previous Env Image') {
            when {
                expression { env.DEPLOY_MODE != 'recovery' }
            }
            options {
                timeout(time: 5, unit: 'MINUTES')
            }
            steps {
                container('docker') {
                    script {
                        echo "Backing up previous environment tags via server-side retag (no layer pull/push)..."
                        withCredentials([usernamePassword(credentialsId: env.REGISTRY_CREDENTIALS_ID, usernameVariable: 'REGISTRY_USER', passwordVariable: 'REGISTRY_PASSWORD')]) {
                            sh """
                                set -euo pipefail
                                echo "\$REGISTRY_PASSWORD" | docker login "${REGISTRY_URL}" -u "\$REGISTRY_USER" --password-stdin

                                backup_image() {
                                  local source_ref="\$1"
                                  local backup_ref="\$2"
                                  local attempt
                                  local manifest_status=1

                                  for attempt in 1 2 3; do
                                    echo "Probing manifest \$source_ref (attempt \$attempt/3)..."
                                    if timeout 30 docker manifest inspect "\$source_ref" >/dev/null 2>&1; then
                                      manifest_status=0
                                      break
                                    fi
                                    echo "Manifest probe attempt \$attempt failed for \$source_ref" >&2
                                    [ \$attempt -lt 3 ] && sleep 3
                                  done

                                  if [ \$manifest_status -ne 0 ]; then
                                    echo "No existing manifest at \$source_ref; backup skipped" >&2
                                    return 0
                                  fi

                                  echo "Retagging \$source_ref -> \$backup_ref via buildx imagetools (server-side)..."
                                  if timeout 60 docker buildx imagetools create --tag "\$backup_ref" "\$source_ref"; then
                                    echo "Backed up \$source_ref -> \$backup_ref"
                                  else
                                    echo "Server-side retag failed for \$source_ref -> \$backup_ref; backup skipped" >&2
                                  fi
                                }

                                backup_image "${env.APP_IMAGE_ENV_REF}" "${env.APP_IMAGE_PREV_REF}"
                                backup_image "${env.CRON_IMAGE_ENV_REF}" "${env.CRON_IMAGE_PREV_REF}"
                                backup_image "${env.RADIUS_IMAGE_ENV_REF}" "${env.RADIUS_IMAGE_PREV_REF}"
                            """
                        }
                    }
                }
            }
        }

        stage('Build Image') {
            when {
                expression { env.DEPLOY_MODE != 'recovery' }
            }
            steps {
                container('docker') {
                    script {
                        echo "Building Docker images for registry refs..."
                        sh """
                            set -euo pipefail
                            mkdir -p .secrets
                            echo 'ci-build-dummy-secret-at-least-32-chars' > .secrets/nextauth_secret.txt
                            echo 'ci-build-dummy-secret-at-least-32-chars' > .secrets/auth_secret.txt
                            echo 'ci-build-dummy-secret-at-least-32-chars' > .secrets/oauth_key.txt

                            export BUILDX_GIT_INFO=0

                            docker build -t ${env.APP_IMAGE_REF} -t ${env.APP_IMAGE_ENV_REF} \
                                --secret id=NEXTAUTH_SECRET,src=.secrets/nextauth_secret.txt \
                                --secret id=AUTH_SECRET,src=.secrets/auth_secret.txt \
                                --secret id=OAUTH_ENCRYPTION_KEY,src=.secrets/oauth_key.txt \
                                --build-arg IMAGE_REVISION="${env.IMAGE_REVISION}" \
                                --label org.opencontainers.image.revision=${env.IMAGE_REVISION} \
                                --build-arg NEXT_PUBLIC_FIREBASE_API_KEY="${env.NEXT_PUBLIC_FIREBASE_API_KEY}" \
                                --build-arg NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="${env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}" \
                                --build-arg NEXT_PUBLIC_FIREBASE_PROJECT_ID="${env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}" \
                                --build-arg NEXT_PUBLIC_FIREBASE_DATABASE_URL="${env.NEXT_PUBLIC_FIREBASE_DATABASE_URL}" \
                                --build-arg NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="${env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}" \
                                --build-arg NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="${env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID}" \
                                --build-arg NEXT_PUBLIC_FIREBASE_APP_ID="${env.NEXT_PUBLIC_FIREBASE_APP_ID}" \
                                --build-arg NEXT_PUBLIC_VAPID_PUBLIC_KEY="${env.NEXT_PUBLIC_VAPID_PUBLIC_KEY}" \
                                .

                            docker build -t ${env.CRON_IMAGE_REF} -t ${env.CRON_IMAGE_ENV_REF} ./cron
                            docker build -t ${env.RADIUS_IMAGE_REF} -t ${env.RADIUS_IMAGE_ENV_REF} -f radius/Dockerfile .
                            rm -rf .secrets
                        """
                    }
                }
            }
        }

        stage('Push Images to Registry') {
            when {
                expression { env.DEPLOY_MODE != 'recovery' }
            }
            steps {
                container('docker') {
                    script {
                        echo "Pushing immutable and environment tags to the registry..."
                        withCredentials([usernamePassword(credentialsId: env.REGISTRY_CREDENTIALS_ID, usernameVariable: 'REGISTRY_USER', passwordVariable: 'REGISTRY_PASSWORD')]) {
                            sh """
                                set -euo pipefail
                                echo "\$REGISTRY_PASSWORD" | docker login "${REGISTRY_URL}" -u "\$REGISTRY_USER" --password-stdin

                                push_and_verify() {
                                  local image_ref="\$1"
                                  docker push "\$image_ref"
                                  docker manifest inspect "\$image_ref" >/dev/null
                                  echo "Verified pushed ref: \$image_ref"
                                }

                                push_and_verify "${env.APP_IMAGE_REF}"
                                push_and_verify "${env.APP_IMAGE_ENV_REF}"
                                push_and_verify "${env.CRON_IMAGE_REF}"
                                push_and_verify "${env.CRON_IMAGE_ENV_REF}"
                                push_and_verify "${env.RADIUS_IMAGE_REF}"
                                push_and_verify "${env.RADIUS_IMAGE_ENV_REF}"
                            """
                        }
                    }
                }
            }
        }

        stage('Database Migration (Zero Downtime K8s Job)') {
            when {
                expression { env.DEPLOY_MODE != 'recovery' }
            }
            options {
                timeout(time: 35, unit: 'MINUTES')
            }
            steps {
                container('kubectl') {
                    script {
                        def isProduction = (DOCKER_TAG == 'production')

                        sh """
                        set -euo pipefail
                        REGISTRY_SECRET="${NAMESPACE}-registry"
                        echo "Verifying registry pull auth secret in ${NAMESPACE}..."
                        if ! kubectl get secret "\$REGISTRY_SECRET" --namespace=${NAMESPACE} >/dev/null 2>&1; then
                          echo "Registry pull auth secret \"\$REGISTRY_SECRET\" tidak ditemukan di namespace ${NAMESPACE}."
                          echo "Pipeline sengaja tidak meng-apply template placeholder ${K8S_DIR}/registry-secret.yaml."
                          echo "Bootstrap secret live di cluster terlebih dahulu sebelum menjalankan ulang pipeline ini."
                          echo "Contoh bootstrap:"
                          echo "kubectl create secret docker-registry \"\$REGISTRY_SECRET\" \\\"
                          echo "  --namespace=${NAMESPACE} \\\"
                          echo "  --docker-server=${REGISTRY_URL} \\\"
                          echo "  --docker-username=<registry-username> \\\"
                          echo "  --docker-password=<registry-token>"
                          exit 1
                        fi

                        require_cluster_nodes_ready_for_production_change() {
                          local change_label="\$1"
                          local node_snapshot

                          node_snapshot="\$(kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{"\\t"}{range .status.conditions[*]}{.type}={.status}{" "}{end}{"\\n"}{end}')"
                          if printf "%s\n" "\$node_snapshot" | grep -Eq "Ready=False|DiskPressure=True"; then
                            echo "❌ Cluster production tidak sehat untuk perubahan workload: ada node Ready=False atau DiskPressure=True" >&2
                            printf "%s\n" "\$node_snapshot" >&2
                            kubectl describe nodes || true
                            kubectl top nodes || true
                            exit 1
                          fi

                          echo "✅ Cluster node preflight aman untuk \$change_label"
                        }
                        """

                        if (isProduction) {
                            sh """
                            set -euo pipefail
                            REGISTRY_SECRET="${NAMESPACE}-registry"
                            echo "Verifying registry pull auth secret in ${NAMESPACE}..."
                            if ! kubectl get secret "\$REGISTRY_SECRET" --namespace=${NAMESPACE} >/dev/null 2>&1; then
                              echo "Registry pull auth secret \"\$REGISTRY_SECRET\" tidak ditemukan di namespace ${NAMESPACE}."
                              echo "Pipeline sengaja tidak meng-apply template placeholder ${K8S_DIR}/registry-secret.yaml."
                              echo "Bootstrap secret live di cluster terlebih dahulu sebelum menjalankan ulang pipeline ini."
                              echo "Contoh bootstrap:"
                              echo "kubectl create secret docker-registry \"\$REGISTRY_SECRET\" \\\"
                              echo "  --namespace=${NAMESPACE} \\\"
                              echo "  --docker-server=${REGISTRY_URL} \\\"
                              echo "  --docker-username=<registry-username> \\\"
                              echo "  --docker-password=<registry-token>"
                              exit 1
                            fi

                            require_cluster_nodes_ready_for_production_change() {
                              local change_label="\$1"
                              local node_snapshot

                              node_snapshot="\$(kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{"\\t"}{range .status.conditions[*]}{.type}={.status}{" "}{end}{"\\n"}{end}')"
                              if printf "%s\n" "\$node_snapshot" | grep -Eq "Ready=False|DiskPressure=True"; then
                                echo "❌ Cluster production tidak sehat untuk perubahan workload: ada node Ready=False atau DiskPressure=True" >&2
                                printf "%s\n" "\$node_snapshot" >&2
                                kubectl describe nodes || true
                                kubectl top nodes || true
                                exit 1
                              fi

                              echo "✅ Cluster node preflight aman untuk \$change_label"
                            }

                            require_cluster_nodes_ready_for_production_change before-production-migration
                            """

                            echo "🔒 PRODUCTION: Creating database backup before migration..."
                            def allowMigrationWithoutBackup = env.ALLOW_MIGRATION_WITHOUT_BACKUP == 'true'
                            def backupStatus = sh(
                                script: """
                                set -euo pipefail
                                BACKUP_FILE="backup_${NAMESPACE}_\$(date +%Y%m%d_%H%M%S).sql.gz"
                                echo "Creating backup streaming to Jenkins workspace: \$BACKUP_FILE"
                                kubectl exec -n ${NAMESPACE} deployment/netmanager-app -- sh -c 'pg_dump "\$DATABASE_URL" --no-owner --no-privileges' | gzip > "\$BACKUP_FILE"
                                ls -lh "\$BACKUP_FILE"
                                """,
                                returnStatus: true
                            )

                            if (backupStatus != 0) {
                                if (allowMigrationWithoutBackup) {
                                    echo "⚠️ Pre-migration backup failed, but migration continues because ALLOW_MIGRATION_WITHOUT_BACKUP=true"
                                } else {
                                    error('Pre-migration backup failed; aborting production migration. Set ALLOW_MIGRATION_WITHOUT_BACKUP=true only for an explicit emergency override.')
                                }
                            } else {
                                echo "✅ Database backup berhasil dibuat."
                            }
                        }

                        echo "Menjalankan K8s Job untuk Database Migration di ${NAMESPACE}..."
                        sh "kubectl delete job netmanager-migration-job --namespace=${NAMESPACE} --ignore-not-found"

                        echo "Memperbarui konfigurasi infrastruktur di ${NAMESPACE}..."
                        sh "kubectl apply -f ${K8S_DIR}/namespace.yaml"
                        sh "kubectl apply -f ${K8S_DIR}/configmap.yaml --namespace=${NAMESPACE}"
                        sh "kubectl apply -f ${K8S_DIR}/db-statefulset.yaml --namespace=${NAMESPACE}"
                        sh "kubectl apply -f ${K8S_DIR}/redis-deployment.yaml --namespace=${NAMESPACE}"
                        sh "kubectl apply -f ${K8S_DIR}/pvc.yaml --namespace=${NAMESPACE}"

                        echo "Menunggu database melakukan inisialisasi..."
                        sleep 20

                        sh """
                        set -euo pipefail
                        SKIP_OPTIONAL_BACKFILL="\$(if [ "${NAMESPACE}" = "netmanager-production" ] || [ "${NAMESPACE}" = "netmanager-staging" ]; then echo true; else echo false; fi)"
                        echo "Migration optional backfill policy: SKIP_OPTIONAL_BACKFILL=\$SKIP_OPTIONAL_BACKFILL"
                        sed -e 's|{{NAMESPACE}}|${NAMESPACE}|g' \
                            -e 's|{{IMAGE_TAG}}|${env.APP_IMAGE_REF}|g' \
                            -e 's|{{REGISTRY_SECRET}}|${NAMESPACE}-registry|g' \
                            -e "s|{{SKIP_OPTIONAL_BACKFILL}}|\${SKIP_OPTIONAL_BACKFILL}|g" \
                            k8s/migration-job.yaml | kubectl apply -f -
                        """

                        def jobStatus = sh(
                            script: """
                                set -euo pipefail
                                echo "Menunggu Kubernetes Job netmanager-migration-job..."
                                MAX_WAIT_SECONDS=1800
                                POLL_INTERVAL=10
                                MAX_ATTEMPTS=\$((MAX_WAIT_SECONDS / POLL_INTERVAL))

                                get_job_status() {
                                    kubectl get job netmanager-migration-job -n ${NAMESPACE} -o jsonpath='{range .status.conditions[?(@.status=="True")]}{.type}{" "}{end}' 2>/dev/null || echo "Waiting"
                                }

                                wait_for_migration_job() {
                                    local i status

                                    for i in \$(seq 1 \$MAX_ATTEMPTS); do
                                        status=\$(get_job_status)
                                        if echo "\$status" | grep -q "Complete"; then
                                            echo "✅ Job Selesai Sukses!"
                                            return 0
                                        elif echo "\$status" | grep -q "Failed"; then
                                            echo "❌ Job Gagal! Status: \$status"
                                            return 1
                                        fi

                                        echo "Status saat ini: \$status... menunggu (\$POLL_INTERVAL detik) [\$i/\$MAX_ATTEMPTS]"
                                        sleep \$POLL_INTERVAL
                                    done

                                    echo "⚠️ Job timeout (\$MAX_WAIT_SECONDS detik)."
                                    return 1
                                }

                                wait_for_migration_job
                            """,
                            returnStatus: true
                        )

                        if (jobStatus != 0) {
                            echo "❌ Migration Job GAGAL! Deployment dibatalkan."
                            sh """
                            set -euo pipefail
                            kubectl describe job netmanager-migration-job --namespace=${NAMESPACE} || true

                            POD_NAME=\$(kubectl get pods --namespace=${NAMESPACE} -l job-name=netmanager-migration-job -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
                            if [ -n "\$POD_NAME" ]; then
                              kubectl get pod "\$POD_NAME" --namespace=${NAMESPACE} -o wide || true
                              kubectl describe pod "\$POD_NAME" --namespace=${NAMESPACE} || true
                              kubectl logs "\$POD_NAME" --namespace=${NAMESPACE} --tail=100 || true
                            else
                              echo "Migration pod not found for diagnostic logging."
                              kubectl logs -l app=netmanager-migration --namespace=${NAMESPACE} --tail=100 || true
                            fi
                            """
                            error("Pipeline berhenti untuk mencegah corrupt data / downtime.")
                        } else {
                            echo "✅ Migration selesai dengan sukses!"
                            sh "kubectl logs -l app=netmanager-migration --namespace=${NAMESPACE} --tail=50 || true"
                        }
                    }
                }
            }
        }

        stage('Deploy to K8s') {
            steps {
                container('kubectl') {
                    script {
                        echo "Deploying to Kubernetes namespace ${NAMESPACE} using ${K8S_DIR}..."
                        sh """
                        set -euo pipefail

                        get_current_image() {
                          local deployment_name="\$1"
                          local container_name="\$2"
                          local deployment_snapshot
                          local current_image

                          if ! deployment_snapshot="\$(kubectl get deployment "\$deployment_name" -n ${NAMESPACE} -o jsonpath='{range .spec.template.spec.containers[*]}{.name}={.image}{"\\n"}{end}')"; then
                            echo "⚠️ Gagal membaca snapshot image dari deployment/\$deployment_name container/\$container_name; lanjutkan tanpa snapshot" >&2
                            printf '%s\n' ""
                            return 0
                          fi

                          current_image="\$(printf '%s\n' "\$deployment_snapshot" | awk -F= -v name="\$container_name" '\$1 == name { print \$2; exit }')"

                          if [ -z "\$current_image" ]; then
                            echo "⚠️ Tidak ada snapshot image sebelumnya untuk deployment/\$deployment_name container/\$container_name" >&2
                          fi

                          printf '%s\n' "\$current_image"
                        }

                        validate_image_ref() {
                          local workload="\$1"
                          local image_ref="\$2"

                          case "\$image_ref" in
                            "${REGISTRY_PATH}/"* )
                              ;;
                            *)
                              echo "❌ Image ref untuk \$workload harus memakai registry resmi: \$image_ref" >&2
                              exit 1
                              ;;
                          esac
                        }

                        require_cluster_nodes_ready_for_production_change() {
                          local change_label="\$1"
                          local node_snapshot

                          node_snapshot="\$(kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{"\\t"}{range .status.conditions[*]}{.type}={.status}{" "}{end}{"\\n"}{end}')"
                          if printf "%s\n" "\$node_snapshot" | grep -Eq "Ready=False|DiskPressure=True"; then
                            echo "❌ Cluster production tidak sehat untuk perubahan workload: ada node Ready=False atau DiskPressure=True" >&2
                            printf "%s\n" "\$node_snapshot" >&2
                            kubectl describe nodes || true
                            kubectl top nodes || true
                            exit 1
                          fi

                          echo "✅ Cluster node preflight aman untuk \$change_label"
                        }

                        render_manifest_to_file() {
                          local manifest="\$1"
                          local rendered_manifest="\$2"

                          sed \
                            -e 's|{{APP_IMAGE}}|${env.APP_DEPLOY_REF}|g' \
                            -e 's|{{CRON_IMAGE}}|${env.CRON_DEPLOY_REF}|g' \
                            -e 's|{{RADIUS_IMAGE}}|${env.RADIUS_DEPLOY_REF}|g' \
                            "\$manifest" > "\$rendered_manifest"

                          if grep -Fq -e "{{APP_IMAGE}}" -e "{{CRON_IMAGE}}" -e "{{RADIUS_IMAGE}}" "\$rendered_manifest"; then
                            echo "❌ Render manifest masih menyisakan placeholder pada \$manifest" >&2
                            exit 1
                          fi
                        }

                        assert_cluster_image_contract() {
                          local deployment_name="\$1"
                          local container_name="\$2"
                          local expected_annotation="deploy.radpro.id/image-ref"
                          local current_image
                          local current_annotation

                          current_image="\$(get_current_image "\$deployment_name" "\$container_name")"

                          if [ -z "\$current_image" ]; then
                            echo "ℹ️ deployment/\$deployment_name belum punya image aktif; skip drift check"
                            return 0
                          fi

                          current_annotation="\$(kubectl get deployment "\$deployment_name" -n ${NAMESPACE} -o jsonpath="{.spec.template.metadata.annotations.deploy\\.radpro\\.id/image-ref}")"

                          validate_image_ref "\$deployment_name" "\$current_image"

                          if [ -z "\$current_annotation" ]; then
                            echo "⚠️ deployment/\$deployment_name belum punya annotation \$expected_annotation; izinkan rollout untuk bootstrap contract" >&2
                            return 0
                          fi

                          if [ "\$current_annotation" != "\$current_image" ]; then
                            echo "❌ Drift terdeteksi pada deployment/\$deployment_name: image aktif \$current_image tidak cocok dengan annotation \$current_annotation" >&2
                            exit 1
                          fi
                        }

                        REGISTRY_SECRET="${NAMESPACE}-registry"

                        echo "Verifying registry pull auth secret in ${NAMESPACE}..."
                        if ! kubectl get secret "\$REGISTRY_SECRET" --namespace=${NAMESPACE} >/dev/null 2>&1; then
                          echo "Registry pull auth secret \"\$REGISTRY_SECRET\" tidak ditemukan di namespace ${NAMESPACE}."
                          echo "Pipeline sengaja tidak meng-apply template placeholder ${K8S_DIR}/registry-secret.yaml."
                          echo "Bootstrap secret live di cluster terlebih dahulu sebelum menjalankan ulang pipeline ini."
                          echo "Contoh bootstrap:"
                          echo "kubectl create secret docker-registry \"\$REGISTRY_SECRET\" \\\"
                          echo "  --namespace=${NAMESPACE} \\\"
                          echo "  --docker-server=${REGISTRY_URL} \\\"
                          echo "  --docker-username=<registry-username> \\\"
                          echo "  --docker-password=<registry-token>"
                          exit 1
                        fi

                        validate_image_ref netmanager-app "${env.APP_DEPLOY_REF}"
                        validate_image_ref netmanager-cron "${env.CRON_DEPLOY_REF}"
                        validate_image_ref netmanager-radius "${env.RADIUS_DEPLOY_REF}"

                        decode_base64_secret_value() {
                          if printf '' | base64 --decode >/dev/null 2>&1; then
                            base64 --decode
                            return
                          fi

                          base64 -d
                        }

                        assert_live_secret_not_placeholder() {
                          local secret_name="\$1"
                          local secret_key="\$2"
                          local encoded_value
                          local current_value

                          if ! encoded_value="\$(kubectl get secret "\$secret_name" -n ${NAMESPACE} -o jsonpath="{.data.\${secret_key}}")"; then
                            echo "❌ Secret live \$secret_name tidak ditemukan; bootstrap secret real dulu sebelum deploy" >&2
                            exit 1
                          fi

                          current_value="\$(printf '%s' "\$encoded_value" | decode_base64_secret_value | tr -d '\r\n')"

                          if [ -z "\$current_value" ]; then
                            echo "❌ Secret live \$secret_name key \$secret_key kosong atau tidak ada; bootstrap secret real dulu sebelum deploy" >&2
                            exit 1
                          fi

                          if [ "\$current_value" = "REPLACE_WITH_REAL_SECRET_BEFORE_DEPLOY" ]; then
                            echo "❌ Secret live \$secret_name key \$secret_key masih placeholder; bootstrap secret real dulu sebelum deploy" >&2
                            exit 1
                          fi
                        }

                        assert_live_secret_not_placeholder netmanager-secrets CRON_SECRET

                        echo "Syncing Firebase runtime secret into ${NAMESPACE}..."
                        FIREBASE_SECRET_NAME="netmanager-firebase-secrets"
                        kubectl create secret generic "\$FIREBASE_SECRET_NAME" \
                          --namespace=${NAMESPACE} \
                          --dry-run=client -o yaml \
                          --from-literal=FIREBASE_PROJECT_ID='${env.FIREBASE_PROJECT_ID}' \
                          --from-literal=FIREBASE_CLIENT_EMAIL='${env.FIREBASE_CLIENT_EMAIL}' \
                          --from-literal=FIREBASE_PRIVATE_KEY='${env.FIREBASE_PRIVATE_KEY}' \
                          \$(if [ -n "${env.FIREBASE_DATABASE_URL}" ]; then printf -- "--from-literal=FIREBASE_DATABASE_URL=%s" "${env.FIREBASE_DATABASE_URL}"; fi) | kubectl apply -f -

                        APP_PREVIOUS_IMAGE="\$(get_current_image netmanager-app app)"
                        WORKER_PREVIOUS_IMAGE="\$(get_current_image netmanager-worker worker)"
                        CRON_PREVIOUS_IMAGE="\$(get_current_image netmanager-cron cron)"
                        RADIUS_PREVIOUS_IMAGE="\$(get_current_image netmanager-radius radius)"

                        if [ "${NAMESPACE}" = "netmanager-production" ]; then
                          assert_cluster_image_contract netmanager-app app
                          assert_cluster_image_contract netmanager-worker worker
                          assert_cluster_image_contract netmanager-cron cron
                          assert_cluster_image_contract netmanager-radius radius
                          require_cluster_nodes_ready_for_production_change before-production-rollout
                        fi

                        kubectl apply -f ${K8S_DIR}/namespace.yaml
                        find ${K8S_DIR}/ -maxdepth 1 -name "*.yaml" ! -name "secrets.yaml" ! -name "registry-secret.yaml" ! -name "namespace.yaml" | sort | while IFS= read -r manifest; do
                          case "\$manifest" in
                            *app-deployment.yaml|*worker-deployment.yaml|*cron-deployment.yaml|*radius-deployment.yaml)
                              rendered_manifest="\$(mktemp)"
                              render_manifest_to_file "\$manifest" "\$rendered_manifest"
                              kubectl apply -f "\$rendered_manifest"
                              rm -f "\$rendered_manifest"
                              ;;
                            *)
                              kubectl apply -f "\$manifest" --namespace=${NAMESPACE}
                              ;;
                          esac
                        done

                        rollout_workload() {
                          local deployment_name="\$1"
                          local previous_image="\$2"
                          local target_image="\$3"

                          if [ -z "\$previous_image" ] || [ "\$previous_image" = "\$target_image" ]; then
                            echo "Image deployment/\$deployment_name belum pasti berubah; forcing restart untuk rollout konfigurasi non-image."
                            kubectl rollout restart deployment/"\$deployment_name" --namespace=${NAMESPACE}
                          fi

                          kubectl rollout status deployment/"\$deployment_name" --namespace=${NAMESPACE} --timeout=600s
                        }

                        rollout_workload netmanager-app "\$APP_PREVIOUS_IMAGE" "${env.APP_DEPLOY_REF}"
                        rollout_workload netmanager-worker "\$WORKER_PREVIOUS_IMAGE" "${env.APP_DEPLOY_REF}"
                        rollout_workload netmanager-cron "\$CRON_PREVIOUS_IMAGE" "${env.CRON_DEPLOY_REF}"
                        rollout_workload netmanager-radius "\$RADIUS_PREVIOUS_IMAGE" "${env.RADIUS_DEPLOY_REF}"

                        kubectl rollout status deployment/netmanager-redis --namespace=${NAMESPACE} --timeout=300s
                        """
                    }
                }
            }
        }

        stage('Cleanup') {
            steps {
                container('docker') {
                    script {
                        echo "Removing pipeline-managed images from the shared Docker daemon..."
                        sh """
                            set -euo pipefail

                            remove_local_image() {
                              local image_ref="\$1"
                              docker image rm -f "\$image_ref" >/dev/null 2>&1 || true
                            }

                            remove_local_image "${env.APP_IMAGE_REF}"
                            remove_local_image "${env.APP_IMAGE_ENV_REF}"
                            remove_local_image "${env.APP_IMAGE_PREV_REF}"
                            remove_local_image "${env.CRON_IMAGE_REF}"
                            remove_local_image "${env.CRON_IMAGE_ENV_REF}"
                            remove_local_image "${env.CRON_IMAGE_PREV_REF}"
                            remove_local_image "${env.RADIUS_IMAGE_REF}"
                            remove_local_image "${env.RADIUS_IMAGE_ENV_REF}"
                            remove_local_image "${env.RADIUS_IMAGE_PREV_REF}"
                        """
                    }
                }
            }
        }
    }

    post {
        always {
            script {
                echo "Final system cleanup..."
                sh "find . -name 'backup_*.sql.gz' -mtime +7 -delete 2>/dev/null || true"
            }
            echo "Pipeline finished."
        }
        success {
            echo "Deployment to ${NAMESPACE} Successful!"
        }
        failure {
            echo "Deployment Failed. Please check logs."
        }
    }
}
