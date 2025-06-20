pipeline {
    agent any

    stages {
        stage('Clone Repo') {
            steps {
                git 'https://github.com/grad-project-2025/backend-grad'
            }
        }
 stage('Install Dependencies') {
    steps {
        sh '''
            curl -fsSL https://bun.sh/install | bash
            export BUN_INSTALL="$HOME/.bun"
            export PATH="$BUN_INSTALL/bin:$PATH"
            bun install
        '''
    }

        stage('Build') {
            steps {
                sh 'bun run build'
            }
        }

        stage('Test') {
            steps {
                sh 'npm test'
            }
        }
    }
}
