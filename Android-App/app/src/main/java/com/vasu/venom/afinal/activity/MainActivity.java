package com.vasu.venom.afinal.activity;

import android.app.ProgressDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.nfc.Tag;
import android.os.Bundle;
import android.speech.RecognizerIntent;
import android.support.v7.app.AppCompatActivity;

import android.util.Log;
import android.view.Menu;
import android.view.MenuInflater;
import android.view.MenuItem;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageButton;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.TextView;
import android.widget.Toast;


import java.io.DataOutputStream;
import java.net.Socket;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

import com.android.volley.Request;
import com.android.volley.Response;
import com.android.volley.VolleyError;
import com.android.volley.toolbox.StringRequest;
import com.vasu.venom.afinal.R;
import com.vasu.venom.afinal.app.AppConfig;
import com.vasu.venom.afinal.app.AppController;
import com.vasu.venom.afinal.helper.SQLiteHandler;
import com.vasu.venom.afinal.helper.SendMessage;
import com.vasu.venom.afinal.helper.SessionManager;


import org.json.JSONException;
import org.json.JSONObject;

public class MainActivity extends AppCompatActivity {

    private static final int REQ_CODE_SPEECH_INPUT = 100;
    private TextView mVoiceInputTv;
    private ImageButton mSpeakBtn;
    private static final String TAG = RegisterActivity.class.getSimpleName();
    private SQLiteHandler db;
    RadioGroup hosttype;
    RadioButton radiolocalhost, radioglobalhost, radiolocal;


    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        hosttype=(RadioGroup) findViewById(R.id.hosttype);
        radioglobalhost=(RadioButton)findViewById(R.id.radioglobalhost);
        radiolocalhost=(RadioButton)findViewById(R.id.radiolocalhost);
        radiolocal=(RadioButton)findViewById(R.id.radiolocal);


        db = new SQLiteHandler(getApplicationContext());

        mVoiceInputTv = (TextView) findViewById(R.id.voiceInput);
        mSpeakBtn = (ImageButton) findViewById(R.id.btnSpeak);

        mSpeakBtn.setOnClickListener(new View.OnClickListener() {

            @Override
            public void onClick(View v) {
                startVoiceInput();
            }
        });
    }

    private void startVoiceInput() {
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault());
        intent.putExtra(RecognizerIntent.EXTRA_PROMPT, "Hello, How can I help you?");
        try {
            startActivityForResult(intent, REQ_CODE_SPEECH_INPUT);
        } catch (ActivityNotFoundException a) {

        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        switch (requestCode) {
            case REQ_CODE_SPEECH_INPUT: {
                if (resultCode == RESULT_OK && null != data) {
                    ArrayList<String> result = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
                    mVoiceInputTv.setText(result.get(0));
                    String msg = result.get(0);
                    String email= getEmail();
                    if(radiolocal.isChecked()){

                        new SendMessage().execute("192.168.43.186", "1997",result.get(0));
                    }
                    else if(radiolocalhost.isChecked()){

                        sendMsg(email,msg,"local");
                    }
                    else if(radioglobalhost.isChecked()){

                        sendMsg(email,msg,"global");
                    }
                    else
                    {
                        Toast.makeText(getApplicationContext(),"Please select host type...",Toast.LENGTH_SHORT).show();
                    }

                }
                break;
            }

        }
    }

    private void sendMsg(final String email, final String msg, final String host) {
        // Tag used to cancel the request
        String tag_string_req = "req_msg";

        StringRequest strReq = new StringRequest(Request.Method.POST,
                AppConfig.URL_Android_pi, new Response.Listener<String>() {

            @Override
            public void onResponse(String response) {
                Log.d(TAG, "Sending Message Rsponse:" + response.toString());


                try {
                    JSONObject jObj = new JSONObject(response);
                    boolean error = jObj.getBoolean("error");

                    // Check for error node in json
                    if (!error) {
                        String errorMsg = jObj.getString("error_msg");
                        Toast.makeText(getApplicationContext(),
                                errorMsg, Toast.LENGTH_LONG).show();

                    } else {
                        // Error in login. Get the error message
                        String errorMsg = jObj.getString("error_msg");
                        Toast.makeText(getApplicationContext(),
                                errorMsg, Toast.LENGTH_LONG).show();
                    }
                } catch (JSONException e) {
                    // JSON error
                    e.printStackTrace();
                    Toast.makeText(getApplicationContext(), "Json error: " + e.getMessage(), Toast.LENGTH_LONG).show();
                }

            }
        }, new Response.ErrorListener() {

            @Override
            public void onErrorResponse(VolleyError error) {
                Log.e(TAG, "Message Sending Error: " + error.getMessage());
                Toast.makeText(getApplicationContext(),
                        error.getMessage(), Toast.LENGTH_LONG).show();
            }
        }) {

            @Override
            protected Map<String, String> getParams() {
                // Posting parameters to login url
                Map<String, String> params = new HashMap<String,String>();
                params.put("email", email);
                params.put("msg", msg);
                params.put("host", host);

                return params;
            }

        };

        // Adding request to request queue
        AppController.getInstance().addToRequestQueue(strReq, tag_string_req);
    }

    private String getEmail()
    {
        HashMap<String, String> user = db.getUserDetails();
        return user.get("email");
    }

    public boolean onCreateOptionsMenu(Menu menu) {

        MenuInflater inflater = getMenuInflater();
        inflater.inflate(R.menu.right_menu, menu);
        return true;
    }

    public boolean onOptionsItemSelected(MenuItem item) {

        switch (item.getItemId()) {
            case R.id.logout:
                startActivity(new Intent(this, LogoutActivity.class));
                return true;
            
            default:
                return super.onOptionsItemSelected(item);
        }

    }
}