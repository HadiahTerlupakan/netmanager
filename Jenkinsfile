// Jenkinsfile (Controller Isolation / Kubernetes Pod version)
pipeline {
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
  - name: node
    image: node:20-alpine
    command: ['cat']
    tty: true
  - name: docker
    image: docker:cli
    command: ['cat']
    tty: true
    securityContext:
      privileged: true
    volumeMounts:
    - name: docker-sock
      mountPath: /var/run/docker.sock
  - name: kubectl
    image: dtzar/helm-kubectl:latest
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

        stage('Build Image') {
            steps {
                container('docker') {
                    script {
                        echo "Building Docker image ${DOCKER_IMAGE}:${DOCKER_TAG}..."
                        sh "docker build -t ${DOCKER_IMAGE}:${DOCKER_TAG} ."
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
                        sh """
                        docker run --rm -i --privileged \\
                            -v /:/host \\
                            -v /var/run/docker.sock:/var/run/docker.sock \\
                            docker:cli \\
                            sh -c "docker save ${DOCKER_IMAGE}:${DOCKER_TAG} | chroot /host /usr/local/bin/k3s ctr images import -"
                        """
                    }
                }
            }
        }

    stage('Deploy to K8s') {
            steps {
                container('kubectl') {
                    script {
                        echo "Deploying to Kubernetes namespace ${NAMESPACE} using ${K8S_DIR}..."
                        // Apply all manifests in correct directory. Pastikan jenkins service account / default pod memiliki role K8s.
                        sh "kubectl apply -f ${K8S_DIR}/ --namespace=${NAMESPACE}"
                        
                        // Force rollout restart
                        sh "kubectl rollout restart deployment/netmanager-app --namespace=${NAMESPACE}"
                    }
                }
            }
        }
    }

    post {
        always {
            echo "Pipeline finished."
        }
        success {
                echo "Deployment to ${ENV} Successful!"
        }
        failure {
            echo "Deployment Failed. Please check logs."
        }
    }
}
