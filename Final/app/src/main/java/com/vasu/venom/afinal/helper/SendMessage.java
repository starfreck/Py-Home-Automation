package com.vasu.venom.afinal.helper;

import android.os.AsyncTask;
import java.io.IOException;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.net.Socket;


public class SendMessage extends AsyncTask<String, String, String> {

    @Override
    protected String doInBackground(String... params){
        try{
            try{
                String IP=params[0];
                int PORT= Integer.parseInt(params[1]);
                String MSG=params[2];

                Socket socket = new Socket(IP,PORT);
                PrintWriter outToServer = new PrintWriter(
                        new OutputStreamWriter(
                                socket.getOutputStream()));
                outToServer.print(MSG);
                outToServer.flush();
            }catch (IOException e){
                e.printStackTrace();
            }
        }catch (Exception e){
            e.printStackTrace();
        }
        return null;
    }
}