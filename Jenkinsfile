pipeline {
  triggers {
    githubPush
  }

  environment {
    aliDockerRegistry = 'registry.cn-beijing.aliyuncs.com/o-w-o'
    aliDockerVpcRegistry = 'registry-vpc.cn-beijing.aliyuncs.com/o-w-o'
    aliDockerInnerRegistry = 'registry-internal.cn-beijing.aliyuncs.com/o-w-o'

    appName = 'pipeline'
    appIoStore = [:]
  }

  agent {
    docker {
      image "${env.aliDockerVpcRegistry}/app-starter"
      label 'latest'
      registryUrl "https://${env.aliDockerVpcRegistry}"
      registryCredentialsId 'aliDockerRegistry'
      args "-u root -v /var/npm/v10/node_modules:/root/.node_modules -v /var/npm/v10/node_global_modules:/root/.node_global_modules"
    }
  }

  stages {
    when {
      branch pattern: "master|release|draft|feature-\\\\d+|hotfix-\\\\d+", comparator: "REGEXP"
    }
    stage('Prepare') {
      steps {
        echo "1 Prepare Stage"
        sh 'printenv'

        echo "1.1 检验 npm 版本"
        sh "npm -v"

        echo "1.2 设置 npm 缓存地址"
        sh "npm config set prefix ~/.node_global_modules && npm config set cache ~/.node_modules"

        echo "1.3 安装 npm"
        sh "npm ci --production"
      }

      parallel {
        stage {
          when {
            branch 'master'
          }
          steps {
            env.appName = "${env.appName}-release"

            echo '1.4 获取 项目 package.json 中的应用信息'
            env.appIoStore.dockerArgsPort = sh(returnStdout: true, script: "NODE_ENV=release node ./script/port.js").trim()
            env.appIoStore.dockerTag = sh(returnStdout: true, script: "NODE_ENV=release node ./script/version.js").trim().toLowerCase()
          }
        }
        stage {
          when {
            branch 'draft'
          }
          steps {
            env.appName = "${env.appName}-draft"

            echo '1.4 获取 项目 package.json 中的应用信息'
            env.appIoStore.dockerArgsPort = sh(returnStdout: true, script: "NODE_ENV=draft node ./script/port.js").trim()
            env.appIoStore.dockerTag = sh(returnStdout: true, script: "NODE_ENV=draft node ./script/version.js").trim().toLowerCase()
          }
        }
        stage {
          steps {
            env.appIoStore.dockerArgsDistDir = 'app'

            env.appIoStore.stashMark = 'src-server-build'
            env.appIoStore.stashIncludeRegex = "**/${env.appIoStore.dockerArgsDistDir}/*"

            env.appIoStore.dockerImageNameUseNormal = "${env.aliDockerRegistry}/${env.appName}"
            env.appIoStore.dockerImageNameUseVpc = "${env.aliDockerVpcRegistry}/${env.appName}"
            env.appIoStore.dockerImageNameUseInner = "${env.aliDockerInnerRegistry}/${env.appName}"

            env.appIoStore.dockerImageName = "${env.appIoStore.dockerImageNameUseVpc}"
            env.appIoStore.dockerImageNameWithTag = "${env.appIoStore.dockerImageName}:${env.appIoStore.dockerTag}"
          }
        }
      }

      stage {
        steps {
          sh 'printenv'
        }
      }
    }

    stage('Build') {
      steps {
        echo "2 Build Docker Image Stage"
      }
      parallel {
        stage('Build Client') {
          steps {
            echo "客户端 构建"
          }
        }
        stage('Build Proxy') {
          steps {
            echo "代理端 构建"
          }
        }
      }
      steps {
        echo "2.2 保存打包后的文件以备后续使用"
        stash(name: "${env.appIoStore.stashMark}", includes: "${env.appIoStore.stashIncludeRegex}")
      }
    }

    stage('Package') {
      steps {
        echo "4.Push Docker Image Stage"

        docker.withRegistry("https://${env.aliDockerVpcRegistry}", 'aliDockerRegistry') {
          echo "4.1 获取 打包文件"
          unstash("${env.appIoStore.stashMark}")

          echo "4.2 预检 Workspace"
          sh "ls -al"

          if (params.ENABLE_DEBUG) {
            input("是否继续进行下一步？")
          }

          echo "4.3 构建 Image"
          env.appIoStore.dockerImage = docker.build(env.appIoStore.dockerImageName, "--build-arg DIST_DIR=${env.appIoStore.dockerArgsDistDir} --build-arg PORT=${env.appIoStore.dockerArgsPort} .")

          echo "4.4 发布 Image"
          env.appIoStore.dockerImage.push()
          env.appIoStore.dockerImage.push("${env.appIoStore.dockerTag}")
        }
      }
    }

    stage('Deploy') {
      steps {
        echo "5. Deploy Stage"

        withCredentials([sshUserPrivateKey(credentialsId: 'aliInkEcs', keyFileVariable: 'identity', passphraseVariable: '', usernameVariable: 'username')]) {
          script {
            def remote = [:]
            remote.name = "o-w-o"
            remote.host = "draft.o-w-o.ink"
            remote.allowAnyHosts = true
            remote.user = username
            remote.identityFile = identity

            try {
              sshCommand remote: remote, command: "docker stop ${env.appName}"
              sshCommand remote: remote, command: "docker rm ${env.appName}"
            } catch (e) {
              echo "部署预处理异常 -> ${e.message}"
              input("部署预处理出现异常，确认继续执行 【${env.appIoStore.dockerImageNameWithTag}】 部署行为？")
            } finally {
              echo "${env.appIoStore.dockerImageNameWithTag}"
            }

            try {
              sshCommand remote: remote, command: "docker pull ${env.appIoStore.dockerImageNameWithTag}"
              sshCommand remote: remote, command: "docker run -i -d --net=host --name=${env.appName} ${env.appIoStore.dockerImageNameWithTag}"
            } catch (e) {
              echo "部署异常 -> ${e.message}"
            } finally {
              echo "部署检测"
              sshCommand remote: remote, command: "docker ps"
            }
          }
        }
      }
      parallel {
        stage('Deploy to ECS') {
          stages {
            stage('For Release') {
              when {
                branch 'master'
              }
              steps {
                echo "In stage Nested 1 within Branch C"
              }
            }
            stage('For Draft') {
              when {
                branch 'draft'
              }
              steps {
                echo "In stage Nested 2 within Branch C"
              }
            }
          }
        }
      }
    }
  }
}
