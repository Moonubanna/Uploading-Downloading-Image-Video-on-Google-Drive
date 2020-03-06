import React, { Component } from 'react';
import {
  Platform,
  StyleSheet,
  View,
  Text,
  Dimensions,
  PermissionsAndroid,
  TouchableHighlight,
  ActivityIndicator
} from 'react-native';
import GoogleSignIn from 'react-native-google-sign-in';
import GDrive from "react-native-google-drive-api-wrapper";
import RNFS from "react-native-fs"
import Video from "react-native-video";
const { width, height } = Dimensions.get('window');

let apiToken = null
const min = 1;
const max = 1000;
const random = min + (Math.random() * (max - min));
const url = 'https://www.googleapis.com/drive/v3' // demo method to understand easier https://developers.google.com/drive/v3/reference/files/list
const uploadUrl = 'https://www.googleapis.com/upload/drive/v3'
const downloadHeaderPath = `${RNFS.ExternalDirectoryPath}/MyVideos_${random}.mp4` // see more path directory https://github.com/itinance/react-native-fs#api
const boundaryString = 'foo_bar_baz' // can be anything unique, needed for multipart upload https://developers.google.com/drive/v3/web/multipart-upload

import ImagePicker from 'react-native-image-picker';
//react-native-camera-roll-picker

/**
* Set api token
*/
function setApiToken(token) {
  //console.warn(token)
  apiToken = token
}

/**
* require write storage permission
*/
async function requestWriteStoragePermission() {
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      {
        'title': 'Write your android storage Permission',
        'message': 'Write your android storage to save your data'
      }
    )
    if (granted === PermissionsAndroid.RESULTS.GRANTED) {
      console.log("You can write storage")
    } else {
      console.log("Write Storage permission denied")
    }
  } catch (err) {
    console.warn(err)
  }
}


/**
* * require read storage permission
*/
async function requestReadStoragePermission() {
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      {
        'title': 'Read your android storage Permission',
        'message': 'Read your android storage to save your data'
      }
    )
    if (granted === PermissionsAndroid.RESULTS.GRANTED) {
      console.log("You can Read storage")
    } else {
      console.log("Read Storage permission denied")
    }
  } catch (err) {
    console.warn(err)
  }
}
export default class App extends React.PureComponent {

  constructor(props) {
    super(props);
    this.checkPermission()
    this.imageUri = undefined
  }
  state = {
    data: null,
    messageImage: undefined,
    isLoading: false,
    driveVideoURL: 'https://drive.google.com/file/d/1zsbeKc9r_yznL-xEDFnNUnofNKyFJQjk/view',
    uploadingDownloading: false,
    downloadedDriveVideoObj: undefined,
    //Need to save database
    rootFolderId: undefined,
    driveUploadedVideoID: undefined
  }

  componentDidMount() {


  }

  // check storage permission
  checkPermission = () => {
    PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE).then((writeGranted) => {
      console.log('writeGranted', writeGranted)
      if (!writeGranted) {
        requestWriteStoragePermission()
      }
      PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE).then((readGranted) => {
        console.log('readGranted', readGranted)
        if (!readGranted) {
          requestReadStoragePermission()
        }
      })
    })
  }

  getDataFromGoogleDrive = async () => {
    await this.initialGoogle()

    if (apiToken) {
      this.checkFile()
    }
  }

  setDataFromGoogleDrive = async (calling_type) => {
    await this.initialGoogle()

    if (apiToken) {
      if (calling_type == 'upload_video') {
        this.finalUploadImageVideoDrive()
      } else {
        this.createFolderDrive()
      }
    }
  }
  //scropes: 'https://www.googleapis.com/auth/drive.appdata'
  //scopes:'https://www.googleapis.com/auth/drive'  Full, permissive scope to access all of a user's files, excluding the Application Data folder.	
  //scopes:'https://www.googleapis.com/auth/drive.activity' Allows read and write access to the Drive Activity API.	
  //scopes:'https://www.googleapis.com/auth/drive.metadata' Allows read-write access to file metadata (excluding downloadUrl and contentHints.thumbnail), 
  //but does not allow any access to read, download, write or upload file content. Does not support file creation, trashing or deletion. 
  //Also does not allow changing folders or sharing in order to prevent access escalation.	
  initialGoogle = async () => {
    // ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/drive.metadata']
    await GoogleSignIn.configure({
      scopes: ['https://www.googleapis.com/auth/drive'],
      shouldFetchBasicProfile: true,
      offlineAccess: true
    });

    const user = await GoogleSignIn.signInPromise();
    //set api token
    setApiToken(user.accessToken)
  }

  selectPhotoTapped = () => {

    const options = {
      title: "Choose Video",
      mediaType: "video"
    };

    let that = this
    ImagePicker.showImagePicker(options, (response) => {

      let sourceUri = undefined;
      console.log('Response = ', response);
      if (response.didCancel) {
        console.log('User cancelled image picker');
        // that.setState({
        //     isLoading: false,
        // });
      } else if (response.error) {
        console.log('ImagePicker Error: ', response);
        var message = 'To be able to take pictures with your camera and choose images from your library.'


        that.twoButtonAlert('Permission denied', message, 'RE-TRY', 'I\'M SURE', function (status) {
          console.log('The button tapped is: ', status);
          if (status == 1) {
            that.openSettingsPage()
          }
        }, function (error) {
          console.log('There was an error fetching the location');
        });
      } else if (response.customButton) {
        console.log('User tapped custom button: ', response.customButton);
        // that.setState({
        //   isLoading: true,
        // });
      } else {
        sourceUri = { uri: response.uri };
        console.warn('sourceUri' + JSON.stringify(response))
        that.setState({
          imageUri: response
        }, () => {
          this.setDataFromGoogleDrive('upload_video')
        })
      }
    });
  }

  finalUploadImageVideoDrive = () => {

    if (apiToken != null && apiToken != undefined) {
      GDrive.setAccessToken(apiToken);
      GDrive.init();
      GDrive.isInitialized() ? true : false;

      this.setState({
        uploadingDownloading: true
      })

      RNFS.readFile(this.state.imageUri.path, 'base64')
        .then((res => {
          GDrive.files.createFileMultipart(
            res,
            "video/mp4",//"video/mp4", image/jpg
            {
              parents: ["1WYGqCQv8BHlpGjDsM5-yIVdkhQgTSxrR"], //or any path
              name: "my_second.mp4"
            },
            true)//make it true because you are passing base64 string otherwise the uploaded file will be not supported
            .then((response) => {
              this.setState({
                uploadingDownloading: false
              })
              this.getVideoIdDrive('my_second.mp4', '1WYGqCQv8BHlpGjDsM5-yIVdkhQgTSxrR', 'video/mp4')
            })
            .catch((message) => {
              this.setState({
                uploadingDownloading: false
              })
              console.warn(message)
            })
        }))
    } else {
      alert('Token not found for upload video on google drive!!')
    }
  }

  createFolderDrive = () => {
    if (apiToken != null && apiToken != undefined) {
      GDrive.setAccessToken(apiToken);
      GDrive.init();
      GDrive.isInitialized() ? true : false;

      GDrive.files.safeCreateFolder({
        name: "praveen_singh",
        parents: ["root"]
      })
        .then((response) => {
          this.setState({
            rootFolderId: response
          })
        }).
        catch((message) => {
          console.warn(message)
        })
    } else {
      alert('Token not found for create folder!!')
    }
  }

  getVideoIdDrive = (name, parent, mimeType) => {
    console.warn('parentt' + JSON.stringify(parent))
    GDrive.setAccessToken(apiToken);
    GDrive.init();
    GDrive.isInitialized() ? true : false;

    GDrive.files.getId(name, [parent], mimeType, false)
      .then((response) => {
        this.setState({
          driveUploadedVideoID: response
        })
      }).
      catch((message) => {
        console.warn('videoIDDrive' + message)
      })
  }

  downloadVideoFromDrive = () => {

    GDrive.setAccessToken(apiToken);
    GDrive.init();
    GDrive.isInitialized() ? true : false;

    this.setState({
      uploadingDownloading: true
    })

    const queryParams = { alt: "media" };
    GDrive.files.get(this.state.driveUploadedVideoID, queryParams)
      .then((response) => {
        console.warn('downloadingFile' + JSON.stringify(response))
        this.setState({
          uploadingDownloading: false
        })
      })
  }

  // download and read file to get data content in downloaded file
  downloadAndReadFile = () => {
    const fromUrl = this.downloadFile(this.state.driveUploadedVideoID)
    let downloadFileOptions = {
      fromUrl: fromUrl,
      toFile: downloadHeaderPath,
    }
    downloadFileOptions.headers = Object.assign({
      "Authorization": `Bearer ${apiToken}`
    }, downloadFileOptions.headers);

    this.setState({
      uploadingDownloading: true
    })

    console.warn('downloadFileOptions', JSON.stringify(downloadFileOptions))

    RNFS.downloadFile(downloadFileOptions).promise.then(res => {
      console.warn('downloadFileObj1' + JSON.stringify(res))
      this.setState({
        uploadingDownloading: false
      })  
      return RNFS.readFile(downloadHeaderPath, 'utf8');
    }).then(content => {
      console.warn('downloadFileObj2' + JSON.stringify(content))
      // this.setState({
      //   downloadedDriveVideoObj: content
      // })
    }).catch(err => {
      console.log('error downloadFileObj', err)
    });
  }

  /**
 * create download url based on id
 */
  downloadFile = (existingFileId) => {
    console.log(existingFileId)
    if (!existingFileId) throw new Error('Didn\'t provide a valid file id.')
    return `${url}/files/${existingFileId}?alt=media`
  }


  render() {
    return (
      <View style={styles.container}>
        <TouchableHighlight style={styles.buttonGetData} onPress={() => {
          //this.setDataFromGoogleDrive('create_folder')
          this.downloadAndReadFile()
          //this.downloadVideoFromDrive()
          //this.getDataFromGoogleDrive
        }}>
          <Text style={styles.text}>
            Get data from Google Drive/Create Folder
                    </Text>
        </TouchableHighlight>
        <TouchableHighlight style={styles.buttonGetData} onPress={() => {
          this.selectPhotoTapped()
        }}>
          <Text style={styles.text}>
            Create data or Update data
                    </Text>
        </TouchableHighlight>
        {this.state.uploadingDownloading &&
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center"
            }}
          >
            <ActivityIndicator size="large" color="#0000ff" />
            {/* <Text>{Math.floor(this.state.progress * 100)}%</Text> */}
            <Text> Please wait while Uploding/Downloading video </Text>
          </View>
        }
        {/* {this.state.driveVideoURL != undefined &&
          <Video
            source={{
              uri: 'https://www.googleapis.com/drive/v3/files?/1zsbeKc9r_yznL-xEDFnNUnofNKyFJQjk?alt=mediaS&name=my_first_video.mp4',//'https://gdurl.com/zxRE', 
              //'https://drive.google.com/open?id=1zsbeKc9r_yznL-xEDFnNUnofNKyFJQjk&name=my_first_video.mp4'
              headers: {
                Authorization: 'Bearer ya29.ImDBB7EOdNLF_cL7VTrgxOrraYyNDCjmxUq4CymRpVutTUD3xYuG9kLUk74dTYH7iyzrclDfz9LH3tXA5fxY1v4K3wztI2QXtZI78kcHeurH3HQsh76uL8N-xFuFApsNXTg',
            }
            }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              bottom: 0,
              right: 0
            }}
            //poster={this.state.thumbnail}
            fullscreen={true}
            resizeMode="contain"
            controls={true}
            //onEnd={() => this.setState({ playVideo: false })}
          />} */}
      </View>
    );
  }

}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5FCFF',
  },
  text: {
    textAlign: 'center',
    color: '#FFFFFF',
    margin: 10,
  },
  textData: {
    textAlign: 'center',
    color: '#333333',
    margin: 10,
  },
  buttonGetData: {
    backgroundColor: '#333',
    padding: 10,
    margin: 10,
  }
});



    // var photo = {
    //   uri: 'file:///storage/emulated/0/Pictures/images/image-dd85ef2d-0b3b-4fca-9015-9787f9a3666a.jpg',
    //   type: ['image/png', 'image/jpeg', 'image/jpg'],
    //   name: 'image-dd85ef2d-0b3b-4fca-9015-9787f9a3666a.jpg',
    // };
    // let header = {
    //   'Authorization': `Bearer ${'ya29.Il_AB9LHI1vO586z8ZX6lUSS2pzYdAbc9WPU89wwQpIwFjue6o3k75kqfM7hwlrJer8ubODoGx06Qh99a0-D9sSd2NmA2T15R76R7XCveSiCi3AuEjmLJt5aJeR45I8tzA'}`,
    //   'Accept': 'application/json',
    //   //'Content-Type': 'multipart/form-data',
    //   'Content-Type': ['image/png', 'image/jpeg', 'image/jpg'],
    // }

    // const ending = `\n${'foo_bar_baz'}--`;
    // let body = `\n${'foo_bar_baz'}\n` +
    //   `Content-Type: ${'application/json; charset=UTF-8'}\n\n` +
    //   `${JSON.stringify({
    //     parents: ["root"], //or any path
    //     name: "photo2.jpg"
    //   })}\n\n${'foo_bar_baz'}\n` + `Content-Type: ${"'image/jpeg'"}\n\n`;
    //   body += `${'file:///storage/emulated/0/Pictures/images/image-dd85ef2d-0b3b-4fca-9015-9787f9a3666a.jpg'}${ending}`;
    // // let body = {
    // //   uri: 'file:///storage/emulated/0/Pictures/images/image-dd85ef2d-0b3b-4fca-9015-9787f9a3666a.jpg',
    // //   mimeType:['image/png', 'image/jpeg', 'image/jpg'],
    // //   name:'abc.jpg'
    // // };

    // //multipart
    // fetch(uploadUrl + '/files?uploadType=media', { method: 'POST', headers: header, body: body })
    //   .then((response) => {
    //     console.warn('responseUPLOAD1' + JSON.stringify(response))
    //   })
    //   .then((responseJson) => {
    //     console.warn('responseUPLOAD2' + JSON.stringify(responseJson))
    //   })
    //   .catch((err) => {
    //     console.log('responseUPLOAD3' + JSON.stringify(err))
    //     console.log(err)
    //   });