/**
 * reuseConnection.ino
 *
 *  Created on: 22.11.2015
 *
 */


#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include "DHT.h"

#define USE_SERIAL Serial
#define DHTPIN D1
#define DHTTYPE DHT22   // DHT 22  (AM2302), AM2321

DHT dht(DHTPIN, DHTTYPE);


HTTPClient http;
const char* SSID = "bichito";     //  your network SSID (name) 
const char* PASS = "vivifafa";  // your network password
const char* NAME = "Pierre";
const char* BASE_URL = "http://192.168.1.10/node/api/";
const char* PAR_TEMP = "temperature/";
const char* PAR_HUM = "humidity/";
const long  DELAY = 60*1000;

void setup_wifi() {
  
  int retries = 0;
  
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(SSID);

  WiFi.begin(SSID, PASS);
  
  while (WiFi.status() != WL_CONNECTED) {
    
    if (retries >= 20){
      Serial.println();
      Serial.print("Wifi Status: ");
      Serial.println(WiFi.status());
      Serial.println("Disconnecting. Next attempt within 20 seconds.");
      WiFi.disconnect();
      delay(10000);
      setup_wifi();
    }
    
    retries++;
    delay(1000);
    Serial.print(".");
  }

  Serial.println();
  Serial.println("WiFi connected");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());
}

int read_sensor(float result[]){
  int retry = 0;
  result[0] = dht.readTemperature();
  result[1] = dht.readHumidity();
  
   while (isnan(result[0]) || isnan(result[1])){
    if (retry >= 10){
      Serial.println("Failed to read from DHT sensor!");
      return 1;
    }
    else {
      // Wait a few seconds between measurements.
      delay(2000);
      retry++;
      result[0] = dht.readTemperature();
      result[1] = dht.readHumidity();
    }
  }
  Serial.println();
  Serial.print("Temperature: ");
  Serial.print(result[0]);
  Serial.print("ºC, ");
  Serial.print("Humidity: ");
  Serial.print(result[1]);
  Serial.println("%");
  
  return 0;
}

void send_post(String _name, String _type, float value){
  char dtostrfbuffer[11];
  dtostrf(value,2, 8, dtostrfbuffer);
  
  http.begin(BASE_URL+_type+_name);
  http.addHeader("Content-Type", "application/json");
  
  //{"value":30.45,"period":"m", "min":28.59, "max":31.12, "avg":30.23,"ts":"2016-06-01T15:10:10Z"}
  String payload = String("{\"value\":") + String(dtostrfbuffer) + String(",\"period\":\"m\"}");
  Serial.println();
  Serial.println("payload: "+payload);
  int httpCode = http.POST(String("{\"value\":")+String(dtostrfbuffer)+String(",\"period\":\"m\"}"));

  // file found at server
   if(httpCode == HTTP_CODE_OK) {
      http.writeToStream(&Serial);
    }
    else {
      Serial.println("[HTTP] POST "+ String(BASE_URL)+_type+_name + String(" failed, error: ") + http.errorToString(httpCode).c_str());
    }
  
  http.end();
}
   
/**
 * Initialize variables, connect sensors and wifi
 *
 */
void setup() {

    Serial.begin(115200);
   // USE_SERIAL.setDebugOutput(true);

    Serial.println();
    Serial.println();
    Serial.println();

    for(uint8_t t = 4; t > 0; t--) {
        Serial.printf("[SETUP] WAIT %d...\n", t);
        Serial.flush();
        delay(1000);
    }

    setup_wifi();

    dht.begin();
    
    // allow reuse (if server supports it)
    http.setReuse(true);
}



void loop() {

    if (WiFi.status() != WL_CONNECTED){
      setup_wifi();
    }
      
    float values[2];
    int result = read_sensor(values);
    
    if (result == 0) {
      
      send_post(NAME,PAR_TEMP,values[0]);

      delay(20);

      send_post(NAME,PAR_HUM,values[1]);
    }
    // wait until next time interval
    delay(DELAY);
}



