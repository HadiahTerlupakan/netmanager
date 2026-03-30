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
    securityContext:
      privileged: true
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
        // Adjust values dynamically based on the current branch
        DOCKER_TAG = "${env.BRANCH_NAME == 'main' || env.GIT_BRANCH == 'origin/main' || env.GIT_BRANCH == 'main' ? 'production' : 'staging'}"
        NAMESPACE = "${env.BRANCH_NAME == 'main' || env.GIT_BRANCH == 'origin/main' || env.GIT_BRANCH == 'main' ? 'netmanager-production' : 'netmanager-staging'}"
        K8S_DIR = "${env.BRANCH_NAME == 'main' || env.GIT_BRANCH == 'origin/main' || env.GIT_BRANCH == 'main' ? 'k8s/production' : 'k8s/staging'}"
    }

    stages {
        stage('Install & Code Quality Check') {
            steps {
                container('node') {
                    script {
                        echo "Running Quality Checks inside Node container..."
                        // Use a safer dummy secret for build/lint
                        withEnv([
                            'DATABASE_URL=postgresql://user:pass@localhost:5432/db',
                            'RADIUS_DATABASE_URL=postgresql://user:pass@localhost:5432/radius',
                            'DATABASE_URL_BILLING=postgresql://user:pass@localhost:5432/billing',
                            'DATABASE_URL_MITRA=postgresql://user:pass@localhost:5432/mitra',
                            'REDIS_URL=redis://localhost:6379',
                            'NEXTAUTH_SECRET=ci-build-dummy-secret-at-least-32-chars',
                            'AUTH_SECRET=ci-build-dummy-secret-at-least-32-chars',
                            'NEXTAUTH_URL=http://localhost:3000'
                        ]) {
                            sh """
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
                            'NEXTAUTH_SECRET=ci-test-dummy-secret-at-least-32-chars',
                            'AUTH_SECRET=ci-test-dummy-secret-at-least-32-chars',
                            'NEXTAUTH_URL=http://localhost:3000'
                        ]) {
                            sh "npm run test:run"
                        }
                    }
                }
            }
        }

        stage('Backup Previous Image') {
            steps {
                container('docker') {
                    script {
                        echo "Backing up previous images as :prev before building new ones..."
                        sh "docker tag ${DOCKER_IMAGE}:${DOCKER_TAG} ${DOCKER_IMAGE}:${DOCKER_TAG}-prev 2>/dev/null || echo 'No previous app image to backup'"
                        sh "docker tag ${CRON_IMAGE}:${DOCKER_TAG} ${CRON_IMAGE}:${DOCKER_TAG}-prev 2>/dev/null || echo 'No previous cron image to backup'"
                        sh "docker tag ${RADIUS_IMAGE}:${DOCKER_TAG} ${RADIUS_IMAGE}:${DOCKER_TAG}-prev 2>/dev/null || echo 'No previous radius image to backup'"
                    }
                }
            }
        }

        stage('Build Image') {
            steps {
                container('docker') {
                    script {
                        echo "Building Docker images for ${DOCKER_TAG} with BuildKit Secrets..."
                        
                        // We create temporary files for secrets to pass them to docker build --secret
                        // In a real Jenkins setup, you should use 'withCredentials' to get these values safely.
                        // Here we use the dummy/CI values if credentials are not explicitly bound.
                        sh """
                        set -euo pipefail
                        mkdir -p .secrets
                        echo 'ci-build-dummy-secret-at-least-32-chars' > .secrets/nextauth_secret.txt
                        echo 'ci-build-dummy-secret-at-least-32-chars' > .secrets/auth_secret.txt
                        echo 'ci-build-dummy-secret-at-least-32-chars' > .secrets/oauth_key.txt

                        docker build -t ${DOCKER_IMAGE}:${DOCKER_TAG} \\
                            --secret id=NEXTAUTH_SECRET,src=.secrets/nextauth_secret.txt \\
                            --secret id=AUTH_SECRET,src=.secrets/auth_secret.txt \\
                            --secret id=OAUTH_ENCRYPTION_KEY,src=.secrets/oauth_key.txt \\
                            .
                        
                        docker build -t ${CRON_IMAGE}:${DOCKER_TAG} ./cron
                        docker build -t ${RADIUS_IMAGE}:${DOCKER_TAG} -f radius/Dockerfile .
                        
                        rm -rf .secrets
                        """
                    }
                }
            }
        }



        stage('Load Image to K3s') {
            steps {
                container('docker') {
                    script {
                        echo "Loading Docker image into K3s containerd using root wrapper..."
                        // Kita spawn kontainer docker sementara dari dalam docker-sock untuk mendapatkan
                        // akses privileged chroot ke mesin host, lalu menjalankan k3s ctr!
                        // Masalah: docker save multi-image bisa merusak parsing nama oleh k3s ctr import.
                        // Solusi: Lakukan satu per satu agar nama image tetap konsisten (menggunakan strip -).
                        sh """
                        set -euo pipefail
                        docker run --rm -i --privileged \\
                            -v /:/host \\
                            -v /var/run/docker.sock:/var/run/docker.sock \\
                            docker:cli \\
                            sh -c "docker save ${DOCKER_IMAGE}:${DOCKER_TAG} | chroot /host /usr/local/bin/k3s ctr images import -"

                        docker run --rm -i --privileged \\
                            -v /:/host \\
                            -v /var/run/docker.sock:/var/run/docker.sock \\
                            docker:cli \\
                            sh -c "docker save ${CRON_IMAGE}:${DOCKER_TAG} | chroot /host /usr/local/bin/k3s ctr images import -"

                        docker run --rm -i --privileged \\
                            -v /:/host \\
                            -v /var/run/docker.sock:/var/run/docker.sock \\
                            docker:cli \\
                            sh -c "docker save ${RADIUS_IMAGE}:${DOCKER_TAG} | chroot /host /usr/local/bin/k3s ctr images import -"

                        echo "Verifikasi image yang terdaftar di k3s:"
                        rm -f .k3s-images.txt
                        docker run --rm -i --privileged -v /:/host docker:cli \\
                            sh -c "chroot /host /usr/local/bin/k3s ctr images list" > .k3s-images.txt
                        grep -F "${DOCKER_IMAGE}:${DOCKER_TAG}" .k3s-images.txt
                        grep -F "${CRON_IMAGE}:${DOCKER_TAG}" .k3s-images.txt
                        grep -F "${RADIUS_IMAGE}:${DOCKER_TAG}" .k3s-images.txt
                        rm -f .k3s-images.txt
                        """
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

                        if (isProduction) {
                            echo "🔒 PRODUCTION: Creating database backup before migration..."
                            // Backup database disalurkan keluar pod ke workspace Jenkins agar persisten
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
                        
                        // 1. Bersihkan Job lama jika ada
                        sh "kubectl delete job netmanager-migration-job --namespace=${NAMESPACE} --ignore-not-found"
                        
                        // 2. Terapkan konfigurasi infrastruktur (DB, Redis, Config) SEBELUM migrasi
                        // Ini krusial agar perbaikan securityContext pada DB segera diterapkan
                        echo "Memperbarui konfigurasi infrastruktur di ${NAMESPACE}..."
                        sh "kubectl apply -f ${K8S_DIR}/namespace.yaml"
                        sh "kubectl apply -f ${K8S_DIR}/configmap.yaml --namespace=${NAMESPACE}"
                        sh "kubectl apply -f ${K8S_DIR}/db-statefulset.yaml --namespace=${NAMESPACE}"
                        sh "kubectl apply -f ${K8S_DIR}/redis-deployment.yaml --namespace=${NAMESPACE}"
                        sh "kubectl apply -f ${K8S_DIR}/pvc.yaml --namespace=${NAMESPACE}"

                        // Tunggu sebentar agar database sempat restart dengan konfigurasi baru
                        echo "Menunggu database melakukan inisialisasi..."
                        sleep 20

                        // 3. Render template dan apply Job
                        sh """
                        sed -e 's|{{NAMESPACE}}|${NAMESPACE}|g' \\
                            -e 's|{{IMAGE_TAG}}|${DOCKER_IMAGE}:${DOCKER_TAG}|g' \\
                            k8s/migration-job.yaml | kubectl apply -f -
                        """
                        
                        // 4. Wait for Job completion or failure
                        def jobStatus = sh(
                            script: """
                                echo "Menunggu Kubernetes Job netmanager-migration-job..."
                                MAX_WAIT_SECONDS=1800
                                POLL_INTERVAL=10
                                MAX_ATTEMPTS=\$((MAX_WAIT_SECONDS / POLL_INTERVAL))

                                get_job_status() {
                                    kubectl get job netmanager-migration-job -n ${NAMESPACE} -o jsonpath='{range .status.conditions[?(@.status=="True")]}{.type}{" "}{end}' 2>/dev/null || echo "Waiting"
                                }

                                wait_for_migration_job() {
                                    local i status

                                    # Tunggu sampai job selesai (Complete) atau gagal (Failed)
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
                            collect_migration_diagnostics() {
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
                            }

                            collect_migration_diagnostics
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
                        // Implementasi Opsi A: Terapkan semua file KECUALI secrets.yaml
                        // Ini agar secret di server tidak tertimpa nilai dummy dari Git
                        sh """
                        set -eu
                        apply_deploy_manifests() {
                          kubectl apply -f ${K8S_DIR}/namespace.yaml
                          find ${K8S_DIR}/ -maxdepth 1 -name "*.yaml" ! -name "secrets.yaml" ! -name "namespace.yaml" | sort | while IFS= read -r manifest; do
                            kubectl apply -f "\$manifest" --namespace=${NAMESPACE}
                          done
                        }

                        apply_deploy_manifests
                        """
                        
                        // Force rollout restart with a slight delay, then verify each workload.
                        sh """
                        set -eu
                        rollout_restart() {
                          case "\$1" in
                            netmanager-app)
                              sleep 5 && (kubectl rollout restart deployment/netmanager-app --namespace=${NAMESPACE} || echo 'Rollout already in progress')
                              ;;
                            netmanager-cron)
                              kubectl rollout restart deployment/netmanager-cron --namespace=${NAMESPACE}
                              ;;
                            netmanager-radius)
                              kubectl rollout restart deployment/netmanager-radius --namespace=${NAMESPACE}
                              ;;
                            *)
                              echo "Unknown deployment for rollout restart: \$1" >&2
                              return 1
                              ;;
                          esac
                        }

                        rollout_status() {
                          case "\$1" in
                            netmanager-app)
                              kubectl rollout status deployment/netmanager-app --namespace=${NAMESPACE} --timeout=600s
                              ;;
                            netmanager-cron)
                              kubectl rollout status deployment/netmanager-cron --namespace=${NAMESPACE} --timeout=300s
                              ;;
                            netmanager-radius)
                              kubectl rollout status deployment/netmanager-radius --namespace=${NAMESPACE} --timeout=300s
                              ;;
                            *)
                              echo "Unknown deployment for rollout status: \$1" >&2
                              return 1
                              ;;
                          esac
                        }

                        for deployment in netmanager-app netmanager-cron netmanager-radius; do
                          rollout_restart "\$deployment"
                        done

                        for deployment in netmanager-app netmanager-cron netmanager-radius; do
                          rollout_status "\$deployment"
                        done
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
                        // Lebih agresif: hapus semua image tak terpakai & build cache
                        sh "docker system prune -f || true"
                        
                        echo "Cleaning up K3s (containerd) unused images..."
                        sh """
                        docker run --rm -i --privileged \\
                            -v /:/host \\
                            docker:cli \\
                            sh -c "chroot /host /usr/local/bin/k3s ctr images prune --all 2>/dev/null || echo 'K3s image prune skipped'"
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
                // Hapus backup files lama (lebih dari 7 hari)
                sh "find . -name 'backup_*.sql.gz' -mtime +7 -delete 2>/dev/null || true"
                
                // Opsional: Hapus workspace Jenkins setelah build selesai untuk menghemat tempat
                // (Hanya jika Anda tidak butuh file sisa untuk debugging selanjutnya)
                // cleanWs() 
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
