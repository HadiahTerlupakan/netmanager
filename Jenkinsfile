pipeline {
    agent { label 'k8s-agent' }

    options {
        skipDefaultCheckout()
    }

    environment {
        DOCKER_IMAGE = "netmanager-app"
        DOCKER_TAG = "staging"
        NAMESPACE = "netmanager-staging"
        GIT_SSH_COMMAND = "ssh -i /home/jenkins/.ssh/id_ed25519 -o StrictHostKeyChecking=no"
    }

    stages {
        stage('Checkout') {
            steps {
                withCredentials([sshUserPrivateKey(credentialsId: 'github-ssh', keyFileVariable: 'SSH_KEY')]) {
                    sh '''
                        export GIT_SSH_COMMAND="ssh -i $SSH_KEY -o StrictHostKeyChecking=no"
                        if [ -d .git ]; then
                            git fetch --tags --force origin
                            git checkout -f origin/main
                        else
                            git clone git@github.com:HadiahTerlupakan/netmanager.git .
                        fi
                    '''
                }
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
