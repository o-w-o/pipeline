def aliDockerRegistry = 'registry.cn-beijing.aliyuncs.com/o-w-o'
def aliDockerVpcRegistry = 'registry-vpc.cn-beijing.aliyuncs.com/o-w-o'
def aliDockerInnerRegistry = 'registry-internal.cn-beijing.aliyuncs.com/o-w-o'

def appName = 'pipeline'
def appIoStore = [:]

pipeline {
  triggers {
    githubPush()
  }

  agent {
    docker {
      image "${aliDockerVpcRegistry}/app-starter"
      label 'latest'
      registryUrl "https://${aliDockerVpcRegistry}"
      registryCredentialsId 'aliDockerRegistry'
      args "-u root -v /var/npm/v10/node_modules:/root/.node_modules -v /var/npm/v10/node_global_modules:/root/.node_global_modules"
    }
  }

  stages {
    stage('Stage') {
      steps {
        echo "Hi ${appName}"
      }
    }
  }
}
