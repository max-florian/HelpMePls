const AWS = require('aws-sdk');
const polly = new AWS.Polly();
const s3 = new AWS.S3();
const translate = new AWS.Translate();
const bucket_name = 'prou-mp3-polly'
    
exports.handler =  async (event, context) => {
    const data = event;
    // se traduce el texto
    const rtrans = await new Promise((resolve, reject) => {
        const params = {
            SourceLanguageCode: 'auto', /* required */
            TargetLanguageCode: data.langcode.substr(0, data.langcode.indexOf('-')), /* required */
            Text: data.text, /* required */
        };
        translate.translateText(params, function(err, data) {
            if (err) { console.log(err, err.stack); reject(err)}            // an error occurred
            else     { console.log('Traduccion exitosa'); resolve(data)}    // successful response
        });
    })
    
    const objectKey = 'audio/' + context.awsRequestId  + '.mp3'
    // send request to Polly
    const  rpo = await new Promise((resolve, reject) => {
        const params = {
            OutputFormat: "mp3", 
            Text: rtrans.TranslatedText, 
            TextType: "text", 
            VoiceId: data.voice,
            LanguageCode: data.langcode
        };
         polly.synthesizeSpeech(params,function(err, data) {
           if (err) { console.log(err, err.stack); reject(err) }// an error occurred
           else     { console.log('Polly request successful'); resolve(data)         }// successful response
           /*
           data = {
            AudioStream: <Binary String>, 
            ContentType: "audio/mpeg", 
            RequestCharacters: 37
           }
           */
        }); 
    })
    // save mp3 from Polly in S3
    const rs3 = await new Promise((resolve, reject) => {
        const params = {
            Bucket: bucket_name,
            Key: objectKey,
            Body: rpo.AudioStream,
            ACL:'public-read',
            ContentType: rpo.ContentType
        }
        s3.putObject(params, (err, data) => {
            if (err) { console.log(err, err.stack); reject(err) }// an error occurred
            else     { console.log('S3 Put object successful!'); resolve(data)         }// successful response
        })
    })
    // getUrl from S3
    const params = { Bucket: bucket_name, Key: objectKey };
    const url = s3.getSignedUrl('getObject', params);
    // send response
    const response = {
        statusCode: 200,
        body: { url }
    }
    return response
};
