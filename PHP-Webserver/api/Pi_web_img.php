<?php
require_once 'include/Config.php';

define('ABSPATH', dirname(dirname(__FILE__))."/Security_images/");


require_once 'include/DB_Functions.php';
$db = new DB_Functions();

// json response array
$response = array("error" => FALSE);

   if(isset($_FILES['image']) && isset($_POST['email'])){

      $errors= array();  
      // receiving the post params
      $email=$_POST['email'];    

        if ($db->isUserExisted($email))
        {
            // user is exist
            $file_name = $_FILES['image']['name'];
            $file_size =$_FILES['image']['size'];
            /////////////////////////////////////////////////
            $image_name = time()."_".$file_name;
            
            //////////////////////////////////////////////////
            $file_fix=ABSPATH.$image_name;
            $file_tmp =$_FILES['image']['tmp_name'];
            //////////////////////////////////////////////////
            $file_type=$_FILES['image']['type'];
            $tmp=explode('.',$_FILES['image']['name']);
            $file_ext=strtolower(end($tmp));
      
            $expensions= array("jpeg","jpg","png");
      
            if(in_array($file_ext,$expensions)=== false){
                $errors[]="extension not allowed, please choose a JPEG or PNG file.";
            }
      
            if($file_size > 2097152){
                $errors[]="File size must be excately 2 MB";
            }
      
            if(empty($errors)==true){
                move_uploaded_file($file_tmp,$file_fix);
            }else{
                $response["error"] = TRUE;
                $response["error_msg"] = "Something wrong in uploading Image!!\nExtension not allowed, please choose a JPEG or PNG file.\nFile size must be excately 2 MB";
                echo json_encode($response);
            }
            $file_fix=str_replace(ROOT_PATH, "",$file_fix);
            $user = $db->storeSecurityCamImgs($email, $file_fix);
            if ($user)
            {
                $response["error"] = FALSE;
                $response["error_msg"] = "Successfully image uploaded to Our Webserver...";
                echo json_encode($response);
            }
            else
            {
                $response["error"] = TRUE;
                $response["error_msg"] = "Unknown error occurred while Uploading Security updates";
                echo json_encode($response);
            }
        }
        else
        {
            // Wrong e-mail request
            $response["error"] = TRUE;
            $response["error_msg"] = "Sorry,no user is registerd with this e-mail !";
            echo json_encode($response);
        } 
   }
   else
   {
        // required post params is missing
        $response["error"] = TRUE;
        $response["error_msg"] = "Required parameters EMAIL or IMAGE is missing!";
        echo json_encode($response);
   }

?>