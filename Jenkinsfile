def aliDockerRegistry = 'registry.cn-beijing.aliyuncs.com/o-w-o'
def aliDockerVpcRegistry = 'registry-vpc.cn-beijing.aliyuncs.com/o-w-o'
def aliDockerInnerRegistry = 'registry-internal.cn-beijing.aliyuncs.com/o-w-o'

def aliDockerRegistryUrl = 'https://${aliDockerVpcRegistry}'

def appName = 'pipeline'
def appIoStore = [:]

def APP_DRFAT_ENV = 'draft'
def APP_RELEASE_ENV = 'release'
def APP_DEFAULT_ENV = 'default'
def appEnv = APP_DEFAULT_ENV

def appEcsPassport = [:]

pipeline {
  agent {
    docker {
      image "${aliDockerVpcRegistry}/app-starter"
      label 'latest'
      registryUrl "${aliDockerRegistryUrl}"
      registryCredentialsId 'aliDockerRegistry'
      args "-u root -v /var/npm/v10/node_modules:/root/.node_modules -v /var/npm/v10/node_global_modules:/root/.node_global_modules"
    }
  }

  environment {
    BRANCH_DRAFT = 'draft'
    BRANCH_RELEASE = 'release'
  }

  options { 
    retry(3) 
  }

  stages {
    stage('setup:global') {
      steps {
        echo "1 Prepare Stage"
        sh 'printenv'

        echo "1.1 检验 npm 版本"
        sh "npm -v"

        echo "1.2 设置 npm 缓存地址"
        sh "npm config set prefix ~/.node_global_modules && npm config set cache ~/.node_modules"
      }
    }

    stage('setup:pkg') {
      steps {
          echo "1 安装 npm 包"
          sh "npm ci --production"
      }
    }

    stage('setup:config') {
      parallel {
        stage('setup:config:release') {
          when {
            branch 'master'
          }
          steps {
            script {
              appName = "${appName}-release"

              echo '1.4 获取 项目 package.json 中的应用信息'
              appIoStore.dockerArgsPort = sh(returnStdout: true, script: "NODE_ENV=release node ./script/port.js").trim()
              appIoStore.dockerTag = sh(returnStdout: true, script: "NODE_ENV=release node ./script/version.js").trim().toLowerCase()

              appEnv = APP_RELEASE_ENV
            }
          }
        }
        stage('setup:config:draft') {
          when {
            branch 'draft'
          }
          steps {
            script {
              appName = "${appName}-draft"

              echo '1.4 获取 项目 package.json 中的应用信息'
              appIoStore.dockerArgsPort = sh(returnStdout: true, script: "NODE_ENV=draft node ./script/port.js").trim()
              appIoStore.dockerTag = sh(returnStdout: true, script: "NODE_ENV=draft node ./script/version.js").trim().toLowerCase()

              appEnv = APP_DRAFT_ENV
            }
          }
        }
        stage('setup:config:common') {
          steps {
            script {
              appIoStore.dockerArgsDistDir = 'app'

              appIoStore.stashMark = 'src-server-build'
              appIoStore.stashIncludeRegex = "**/${appIoStore.dockerArgsDistDir}/*"

              appIoStore.dockerImageNameUseNormal = "${aliDockerRegistry}/${appName}"
              appIoStore.dockerImageNameUseVpc = "${aliDockerVpcRegistry}/${appName}"
              appIoStore.dockerImageNameUseInner = "${aliDockerInnerRegistry}/${appName}"

              appIoStore.dockerImageName = "${appIoStore.dockerImageNameUseVpc}"
              appIoStore.dockerImageNameWithTag = "${appIoStore.dockerImageName}:${appIoStore.dockerTag}"
            }
          }
        }
      }
    }

    stage('setup:debug') {
      when {
        expression { BRANCH_NAME != 'master' }
      }
      steps {
        sh 'printenv'
      }
    }

    stage('build:dist') {
      parallel {
        stage('build:client') {
          steps {
            echo "客户端 构建"
          }
        }
        stage('build:proxy') {
          steps {
            echo "代理端 构建"
          }
        }
        stage('build:server') {
          steps {
            echo "服务端 构建"
          }
        }
      }
    }

    stage('build:stash') {
      steps {
        echo "2.2 保存打包后的文件以备后续使用"
        stash(name: "${appIoStore.stashMark}", includes: "${appIoStore.stashIncludeRegex}")
      }
    }

    stage('package') {
      steps {
        echo "4.Push Docker Image Stage"

        script {
          docker.withRegistry("https://${aliDockerVpcRegistry}", 'aliDockerRegistry') {
            echo "4.1 获取 打包文件"
            unstash("${appIoStore.stashMark}")

            echo "4.2 预检 Workspace"
            sh "ls -al"

            if (params.ENABLE_DEBUG) {
              input("是否继续进行下一步？")
            }

            echo "4.3 构建 Image"
            appIoStore.dockerImage = docker.build(appIoStore.dockerImageName, "--build-arg DIST_DIR=${appIoStore.dockerArgsDistDir} --build-arg PORT=${appIoStore.dockerArgsPort} .")

            echo "4.4 发布 Image"
            appIoStore.dockerImage.push()
            appIoStore.dockerImage.push("${appIoStore.dockerTag}")
          }
        }
      }
    }

    stage('setup:ecs') {
      steps {
        withCredentials([sshUserPrivateKey(credentialsId: 'aliInkEcs', keyFileVariable: 'identity', passphraseVariable: '', usernameVariable: 'username')]) {
          script {
            def remote = [:]
            appEcsPassport.name = "o-w-o"
            appEcsPassport.host = "draft.o-w-o.ink"
            appEcsPassport.allowAnyHosts = true
            appEcsPassport.user = username
            appEcsPassport.identityFile = identity
          }
        }
      }
    }

    stage('deploy') {
      parallel {
        stage('Deploy to ECS') {
          stages {
            stage('For Release') {
              when {
                branch 'master'
              }
              steps {
                script {
                  try {
                    sshCommand remote: remote, command: "docker stop ${appName}"
                    sshCommand remote: remote, command: "docker rm ${appName}"
                  } catch (e) {
                    echo "部署预处理异常 -> ${e.message}"
                    input("部署预处理出现异常，确认继续执行 【${appIoStore.dockerImageNameWithTag}】 部署行为？")
                  } finally {
                    echo "${appIoStore.dockerImageNameWithTag}"
                  }

                  try {
                    sshCommand remote: remote, command: "docker pull ${appIoStore.dockerImageNameWithTag}"
                    sshCommand remote: remote, command: "docker run -i -d --net=host --name=${appName} ${appIoStore.dockerImageNameWithTag}"
                  } catch (e) {
                    echo "部署异常 -> ${e.message}"
                  } finally {
                    echo "部署检测"
                    sshCommand remote: remote, command: "docker ps"
                  }
                }
              }
            }
            stage('For Draft') {
              when {
                branch 'draft'
              }
              steps {
                script {
                  try {
                    sshCommand remote: remote, command: "docker stop ${appName}"
                    sshCommand remote: remote, command: "docker rm ${appName}"
                  } catch (e) {
                    echo "部署预处理异常 -> ${e.message}"
                    input("部署预处理出现异常，确认继续执行 【${appIoStore.dockerImageNameWithTag}】 部署行为？")
                  } finally {
                    echo "${appIoStore.dockerImageNameWithTag}"
                  }

                  try {
                    sshCommand remote: remote, command: "docker pull ${appIoStore.dockerImageNameWithTag}"
                    sshCommand remote: remote, command: "docker run -i -d --net=host --name=${appName} ${appIoStore.dockerImageNameWithTag}"
                  } catch (e) {
                    echo "部署异常 -> ${e.message}"
                  } finally {
                    echo "部署检测"
                    sshCommand remote: remote, command: "docker ps"
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
