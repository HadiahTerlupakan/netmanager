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
    image: jenkins/inbound-agent:latest
    imagePullPolicy: IfNotPresent
  - name: node
    image: node:24-alpine
    imagePullPolicy: IfNotPresent
    command: ['cat']
    tty: true
  - name: docker
    image: docker:cli
    imagePullPolicy: IfNotPresent
    command: ['cat']
    tty: true
    volumeMounts:
    - name: docker-sock
      mountPath: /var/run/docker.sock
  - name: kubectl
    image: dtzar/helm-kubectl:latest
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

    environment {
        DOCKER_IMAGE = "netmanager-app"
        CRON_IMAGE = "netmanager-cron"
        RADIUS_IMAGE = "netmanager-radius"
        DOCKER_BUILDKIT = "1"
        DOCKER_TAG = "${env.BRANCH_NAME == 'main' || env.GIT_BRANCH == 'origin/main' || env.GIT_BRANCH == 'main' ? 'production' : 'staging'}"
        IMAGE_VERSION = "${((env.GIT_COMMIT ?: 'nogit').take(12))}-${env.BUILD_NUMBER ?: '0'}"
        REGISTRY_URL = ""
        REGISTRY_NAMESPACE = ""
        REGISTRY_CREDENTIALS_ID = ""
        APP_IMAGE_REF = ""
        CRON_IMAGE_REF = ""
        RADIUS_IMAGE_REF = ""
        APP_IMAGE_ENV_REF = ""
        CRON_IMAGE_ENV_REF = ""
        RADIUS_IMAGE_ENV_REF = ""
        APP_IMAGE_PREV_REF = ""
        CRON_IMAGE_PREV_REF = ""
        RADIUS_IMAGE_PREV_REF = ""
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

                    def requireValue = { String value, String message ->
                        if (!value?.trim()) {
                            error(message)
                        }
                    }

                    def getRuntimeConfig = { String preferredName, String legacyName ->
                        def preferredValue = (System.getenv(preferredName) ?: '').trim()
                        def legacyValue = (System.getenv(legacyName) ?: '').trim()

                        return preferredValue ?: legacyValue
                    }

                    env.REGISTRY_URL = normalizeRegistryUrl(getRuntimeConfig('NETMANAGER_REGISTRY_URL', 'REGISTRY_URL'))
                    env.REGISTRY_NAMESPACE = getRuntimeConfig('NETMANAGER_REGISTRY_NAMESPACE', 'REGISTRY_NAMESPACE').trim()
                    env.REGISTRY_CREDENTIALS_ID = getRuntimeConfig('NETMANAGER_REGISTRY_CREDENTIALS_ID', 'REGISTRY_CREDENTIALS_ID').trim()

                    requireValue(env.REGISTRY_URL, 'NETMANAGER_REGISTRY_URL (atau REGISTRY_URL) wajib disediakan di runtime Jenkins.')
                    requireValue(env.REGISTRY_NAMESPACE, 'NETMANAGER_REGISTRY_NAMESPACE (atau REGISTRY_NAMESPACE) wajib disediakan di runtime Jenkins.')
                    requireValue(env.REGISTRY_CREDENTIALS_ID, 'NETMANAGER_REGISTRY_CREDENTIALS_ID (atau REGISTRY_CREDENTIALS_ID) wajib disediakan di runtime Jenkins.')

                    env.REGISTRY_PATH = "${env.REGISTRY_URL}/${env.REGISTRY_NAMESPACE}"
                    env.APP_IMAGE_REF = "${env.REGISTRY_PATH}/${DOCKER_IMAGE}:${IMAGE_VERSION}"
                    env.CRON_IMAGE_REF = "${env.REGISTRY_PATH}/${CRON_IMAGE}:${IMAGE_VERSION}"
                    env.RADIUS_IMAGE_REF = "${env.REGISTRY_PATH}/${RADIUS_IMAGE}:${IMAGE_VERSION}"
                    env.APP_IMAGE_ENV_REF = "${env.REGISTRY_PATH}/${DOCKER_IMAGE}:${DOCKER_TAG}"
                    env.CRON_IMAGE_ENV_REF = "${env.REGISTRY_PATH}/${CRON_IMAGE}:${DOCKER_TAG}"
                    env.RADIUS_IMAGE_ENV_REF = "${env.REGISTRY_PATH}/${RADIUS_IMAGE}:${DOCKER_TAG}"
                    env.APP_IMAGE_PREV_REF = "${env.REGISTRY_PATH}/${DOCKER_IMAGE}:${DOCKER_TAG}-prev"
                    env.CRON_IMAGE_PREV_REF = "${env.REGISTRY_PATH}/${CRON_IMAGE}:${DOCKER_TAG}-prev"
                    env.RADIUS_IMAGE_PREV_REF = "${env.REGISTRY_PATH}/${RADIUS_IMAGE}:${DOCKER_TAG}-prev"

                    echo "Registry configured: ${env.REGISTRY_PATH}"
                    echo "Immutable refs: ${env.APP_IMAGE_REF}, ${env.CRON_IMAGE_REF}, ${env.RADIUS_IMAGE_REF}"
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
                                npm ci --no-audit --prefer-offline
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
            steps {
                container('docker') {
                    script {
                        echo "Backing up previous environment tags from registry before publishing new images..."
                        withCredentials([usernamePassword(credentialsId: env.REGISTRY_CREDENTIALS_ID, usernameVariable: 'REGISTRY_USER', passwordVariable: 'REGISTRY_PASSWORD')]) {
                            sh """
                                set -euo pipefail
                                echo "\$REGISTRY_PASSWORD" | docker login "${REGISTRY_URL}" -u "\$REGISTRY_USER" --password-stdin

                                backup_image() {
                                  local source_ref="\$1"
                                  local backup_ref="\$2"

                                  if docker pull "\$source_ref"; then
                                    docker tag "\$source_ref" "\$backup_ref"
                                    docker push "\$backup_ref"
                                    docker manifest inspect "\$backup_ref" >/dev/null
                                    echo "Backed up \$source_ref -> \$backup_ref"
                                  else
                                    echo "No existing image found for \$source_ref; backup skipped"
                                  fi
                                }

                                backup_image "${APP_IMAGE_ENV_REF}" "${APP_IMAGE_PREV_REF}"
                                backup_image "${CRON_IMAGE_ENV_REF}" "${CRON_IMAGE_PREV_REF}"
                                backup_image "${RADIUS_IMAGE_ENV_REF}" "${RADIUS_IMAGE_PREV_REF}"
                            """
                        }
                    }
                }
            }
        }

        stage('Build Image') {
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

                            docker build -t ${APP_IMAGE_REF} -t ${APP_IMAGE_ENV_REF} \
                                --secret id=NEXTAUTH_SECRET,src=.secrets/nextauth_secret.txt \
                                --secret id=AUTH_SECRET,src=.secrets/auth_secret.txt \
                                --secret id=OAUTH_ENCRYPTION_KEY,src=.secrets/oauth_key.txt \
                                .

                            docker build -t ${CRON_IMAGE_REF} -t ${CRON_IMAGE_ENV_REF} ./cron
                            docker build -t ${RADIUS_IMAGE_REF} -t ${RADIUS_IMAGE_ENV_REF} -f radius/Dockerfile .
                            rm -rf .secrets
                        """
                    }
                }
            }
        }

        stage('Push Images to Registry') {
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

                                push_and_verify "${APP_IMAGE_REF}"
                                push_and_verify "${APP_IMAGE_ENV_REF}"
                                push_and_verify "${CRON_IMAGE_REF}"
                                push_and_verify "${CRON_IMAGE_ENV_REF}"
                                push_and_verify "${RADIUS_IMAGE_REF}"
                                push_and_verify "${RADIUS_IMAGE_ENV_REF}"
                            """
                        }
                    }
                }
            }
        }

        stage('Database Migration (Zero Downtime K8s Job)') {
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
                        kubectl get secret "${REGISTRY_SECRET}" --namespace=${NAMESPACE} >/dev/null
                        """

                        if (isProduction) {
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
                        REGISTRY_SECRET="${NAMESPACE}-registry"
                        sed -e 's|{{NAMESPACE}}|${NAMESPACE}|g' \
                            -e 's|{{IMAGE_TAG}}|${APP_IMAGE_REF}|g' \
                            -e 's|{{REGISTRY_SECRET}}|${REGISTRY_SECRET}|g' \
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

                          kubectl get deployment "\$deployment_name" -n ${NAMESPACE} -o jsonpath='{range .spec.template.spec.containers[*]}{.name}={.image}{"\n"}{end}' 2>/dev/null | awk -F= -v name="\$container_name" '\$1 == name { print \$2; exit }' || true
                        }

                        render_manifest() {
                          local manifest="\$1"
                          sed \
                            -e 's|{{APP_IMAGE}}|${APP_IMAGE_REF}|g' \
                            -e 's|{{CRON_IMAGE}}|${CRON_IMAGE_REF}|g' \
                            -e 's|{{RADIUS_IMAGE}}|${RADIUS_IMAGE_REF}|g' \
                            "\$manifest"
                        }

                        REGISTRY_SECRET="${NAMESPACE}-registry"

                        echo "Verifying registry pull auth secret in ${NAMESPACE}..."
                        kubectl get secret "${REGISTRY_SECRET}" --namespace=${NAMESPACE} >/dev/null

                        APP_PREVIOUS_IMAGE="\$(get_current_image netmanager-app app)"
                        CRON_PREVIOUS_IMAGE="\$(get_current_image netmanager-cron cron)"
                        RADIUS_PREVIOUS_IMAGE="\$(get_current_image netmanager-radius radius)"

                        kubectl apply -f ${K8S_DIR}/namespace.yaml
                        find ${K8S_DIR}/ -maxdepth 1 -name "*.yaml" ! -name "secrets.yaml" ! -name "registry-secret.yaml" ! -name "namespace.yaml" | sort | while IFS= read -r manifest; do
                          case "\$manifest" in
                            *app-deployment.yaml|*cron-deployment.yaml|*radius-deployment.yaml)
                              render_manifest "\$manifest" | kubectl apply -f -
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

                          if [ -n "\$previous_image" ] && [ "\$previous_image" = "\$target_image" ]; then
                            echo "Image deployment/\$deployment_name sudah sesuai target; forcing restart untuk rollout konfigurasi non-image."
                            kubectl rollout restart deployment/"\$deployment_name" --namespace=${NAMESPACE}
                          fi

                          kubectl rollout status deployment/"\$deployment_name" --namespace=${NAMESPACE} --timeout=600s
                        }

                        rollout_workload netmanager-app "\$APP_PREVIOUS_IMAGE" "${APP_IMAGE_REF}"
                        rollout_workload netmanager-cron "\$CRON_PREVIOUS_IMAGE" "${CRON_IMAGE_REF}"
                        rollout_workload netmanager-radius "\$RADIUS_PREVIOUS_IMAGE" "${RADIUS_IMAGE_REF}"

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
                        echo "Cleaning up Docker system and build cache..."
                        sh "set -euo pipefail; docker system prune -f || true"
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
