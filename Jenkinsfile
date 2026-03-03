pipeline {
    agent { label 'built-in' }

    environment {
        DOCKER_IMAGE = "netmanager-app"
        // Adjust values dynamically based on the current branch
        DOCKER_TAG = "${env.BRANCH_NAME == 'main' || env.GIT_BRANCH == 'origin/main' || env.GIT_BRANCH == 'main' ? 'production' : 'staging'}"
        NAMESPACE = "${env.BRANCH_NAME == 'main' || env.GIT_BRANCH == 'origin/main' || env.GIT_BRANCH == 'main' ? 'netmanager-production' : 'netmanager-staging'}"
        K8S_DIR = "${env.BRANCH_NAME == 'main' || env.GIT_BRANCH == 'origin/main' || env.GIT_BRANCH == 'main' ? 'k8s/production' : 'k8s/staging'}"
    }

    stages {
        stage('Build Image') {
            steps {
                script {
                    echo "Building Docker image ${DOCKER_IMAGE}:${DOCKER_TAG}..."
                    sh "docker build -t ${DOCKER_IMAGE}:${DOCKER_TAG} ."
                }
            }
        }

        stage('Load Image to K3s') {
            steps {
                script {
                    echo "Loading Docker image into K3s containerd..."
                    sh "docker save ${DOCKER_IMAGE}:${DOCKER_TAG} | sudo k3s ctr images import -"
                }
            }
        }

    stage('Deploy to K8s') {
            steps {
                script {
                    echo "Deploying to Kubernetes namespace ${NAMESPACE} using ${K8S_DIR}..."
                    // Apply all manifests in correct directory
                    sh "kubectl apply -f ${K8S_DIR}/ --namespace=${NAMESPACE}"
                    
                    // Force rollout restart
                    sh "kubectl rollout restart deployment/netmanager-app --namespace=${NAMESPACE}"
                }
            }
        }
    }

    post {
        always {
            echo "Pipeline finished."
        }
        success {
            echo "Deployment to Staging Successful!"
        }
        failure {
            echo "Deployment Failed. Please check logs."
        }
    }
}
