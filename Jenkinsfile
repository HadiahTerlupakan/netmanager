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
    image: node:20-alpine
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
                        withEnv([
                            'DATABASE_URL=postgresql://user:pass@localhost:5432/db',
                            'RADIUS_DATABASE_URL=postgresql://user:pass@localhost:5432/radius',
                            'DATABASE_URL_BILLING=postgresql://user:pass@localhost:5432/billing',
                            'DATABASE_URL_MITRA=postgresql://user:pass@localhost:5432/mitra',
                            'REDIS_URL=redis://localhost:6379',
                            'NEXTAUTH_SECRET=build-time-secret',
                            'NEXTAUTH_URL=http://localhost:3000'
                        ]) {
                            sh "npm install && npm run prisma:generate && npm run lint && npm run typecheck"
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
                            'NEXTAUTH_SECRET=build-time-secret',
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
                        // Simpan image lama sebagai cadangan (:prev), abaikan jika belum ada
                        sh "docker tag ${DOCKER_IMAGE}:${DOCKER_TAG} ${DOCKER_IMAGE}:${DOCKER_TAG}-prev 2>/dev/null || echo 'No previous app image to backup'"
                        sh "docker tag ${CRON_IMAGE}:${DOCKER_TAG} ${CRON_IMAGE}:${DOCKER_TAG}-prev 2>/dev/null || echo 'No previous cron image to backup'"
                    }
                }
            }
        }

        stage('Build Image') {
            steps {
                container('docker') {
                    script {
                        echo "Building Docker images for ${DOCKER_TAG}..."
                        sh "docker build -t ${DOCKER_IMAGE}:${DOCKER_TAG} ."
                        sh "docker build -t ${CRON_IMAGE}:${DOCKER_TAG} ./cron"
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

                        echo "Verifikasi image yang terdaftar di k3s:"
                        docker run --rm -i --privileged -v /:/host docker:cli \\
                            chroot /host /usr/local/bin/k3s ctr images list | grep netmanager || true
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
                            def backupStatus = sh(
                                script: """
                                BACKUP_FILE="backup_${NAMESPACE}_\$(date +%Y%m%d_%H%M%S).sql.gz"
                                echo "Creating backup streaming to Jenkins workspace: \$BACKUP_FILE"
                                kubectl exec -n ${NAMESPACE} deployment/netmanager-app -- sh -c 'pg_dump "\$DATABASE_URL" --no-owner --no-privileges' | gzip > "\$BACKUP_FILE"
                                ls -lh "\$BACKUP_FILE"
                                """,
                                returnStatus: true
                            )

                            if (backupStatus != 0) {
                                echo "⚠️ Warning: Pre-migration backup failed (mungkin pod belum ada), tapi migration dilanjutkan."
                            } else {
                                echo "✅ Database backup berhasil dibuat."
                            }
                        }

                        echo "Menjalankan K8s Job untuk Database Migration di ${NAMESPACE}..."
                        
                        // 1. Bersihkan Job lama jika ada
                        sh "kubectl delete job netmanager-migration-job --namespace=${NAMESPACE} --ignore-not-found"
                        
                        // 2. Terapkan config map TERBARU sebelum job jalan
                        sh "kubectl apply -f ${K8S_DIR}/configmap.yaml --namespace=${NAMESPACE} || true"

                        // 3. Render template dan apply Job
                        sh """
                        sed -e 's|{{NAMESPACE}}|${NAMESPACE}|g' \\
                            -e 's|{{IMAGE_TAG}}|${DOCKER_IMAGE}:${DOCKER_TAG}|g' \\
                            k8s/migration-job.yaml | kubectl apply -f -
                        """
                        
                        // 4. Wait for Job completion or failure (lebih efisien daripada loop manual)
                        def jobStatus = sh(
                            script: """
                                echo "Menunggu Kubernetes Job netmanager-migration-job (timeout 30 menit)..."
                                # Gunakan kubectl wait untuk deteksi completion yang lebih clean
                                if kubectl wait --for=condition=complete job/netmanager-migration-job -n ${NAMESPACE} --timeout=1800s; then
                                    exit 0
                                else
                                    # Jika bukan complete, cek apakah failed
                                    if kubectl get job netmanager-migration-job -n ${NAMESPACE} -o jsonpath='{.status.conditions[?(@.type=="Failed")].status}' | grep -q "True"; then
                                        echo "❌ Job GAGAL terdeteksi."
                                        exit 1
                                    else
                                        echo "⚠️ Job timeout atau status tidak diketahui."
                                        exit 1
                                    fi
                                fi
                            """,
                            returnStatus: true
                        )
                        
                        if (jobStatus != 0) {
                            echo "❌ Migration Job GAGAL! Deployment dibatalkan."
                            sh "kubectl logs -l app=netmanager-migration --namespace=${NAMESPACE} --tail=100 || true"
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
                        // Apply all manifests (termasuk Deployment aplikasi yang baru)
                        sh "kubectl apply -f ${K8S_DIR}/ --namespace=${NAMESPACE}"
                        
                        // Force rollout restart with a slight delay.
                        sh "sleep 5 && (kubectl rollout restart deployment/netmanager-app --namespace=${NAMESPACE} || echo 'Rollout already in progress')"
                        
                        // Wait for the rollout to complete
                        sh "kubectl rollout status deployment/netmanager-app --namespace=${NAMESPACE} --timeout=600s"
                    }
                }
            }
        }
        stage('Cleanup') {
            steps {
                container('docker') {
                    script {
                        echo "Cleaning up old Docker images and build cache..."
                        // Hapus dangling images (image lama tanpa tag)
                        sh "docker image prune -f || true"
                        // Hapus build cache yang lebih dari 24 jam
                        sh "docker builder prune -f --filter 'until=24h' || true"
                        // Bersihkan image tak terpakai di K3s containerd
                        sh """
                        docker run --rm -i --privileged \
                            -v /:/host \
                            docker:cli \
                            sh -c "chroot /host /usr/local/bin/k3s ctr images prune --all 2>/dev/null || echo 'K3s image prune skipped'"
                        """
                    }
                }
            }
        }
    }

    post {
        always {
            echo "Pipeline finished."
            // Hapus backup files lama (lebih dari 7 hari)
            sh "find . -name 'backup_*.sql.gz' -mtime +7 -delete 2>/dev/null || true"
        }
        success {
                echo "Deployment to ${NAMESPACE} Successful!"
        }
        failure {
            echo "Deployment Failed. Please check logs."
        }
    }
}
