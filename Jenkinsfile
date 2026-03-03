pipeline {
    agent any

    environment {
        DOCKER_IMAGE = "netmanager-app"
        DOCKER_TAG = "staging"
        DOCKER_REGISTRY = "141.11.160.150:5000" // Registry lokal di server staging
        NAMESPACE = "netmanager-staging"
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Build Image') {
            steps {
                script {
                    echo "Building Docker image ${DOCKER_IMAGE}:${DOCKER_TAG}..."
                    sh "docker build -t ${DOCKER_IMAGE}:${DOCKER_TAG} ."
                }
            }
        }

        stage('Push Image') {
            steps {
                script {
                    // Pastikan kredensial docker sudah dikonfigurasi di Jenkins
                    echo "Pushing Image to Registry..."
                    sh "docker tag ${DOCKER_IMAGE}:${DOCKER_TAG} ${DOCKER_REGISTRY}/${DOCKER_IMAGE}:${DOCKER_TAG}"
                    sh "docker push ${DOCKER_REGISTRY}/${DOCKER_IMAGE}:${DOCKER_TAG}"
                }
            }
        }

        stage('Deploy to K8s') {
            steps {
                script {
                    echo "Deploying to Kubernetes namespace ${NAMESPACE}..."
                    // Apply all manifests in k8s/staging
                    sh "kubectl apply -f k8s/staging/ --namespace=${NAMESPACE}"
                    
                    // Force rollout restart if image tag is same
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
