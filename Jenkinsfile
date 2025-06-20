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
                sh 'bun install'
            }
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
