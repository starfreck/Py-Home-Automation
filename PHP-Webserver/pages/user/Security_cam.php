<?php

if($_SESSION['sid']==session_id() && $_SESSION['login_type']=='user')
{
$email=$_SESSION['email'];

include'pages/connection.php';
$conn = new mysqli($servername, $username, $password,$dbname);
	if ($conn)
	{
		//echo"<center>";
		//echo"<h2>Registered Devices Details</h2><hr/>";
		echo"<h2 class=\"my-4 text-center text-lg-left\">Detected Faces In Camera</h2>";
		echo"<hr>";	
		echo"<br>";
		echo"<div class=\"row text-center text-lg-left\">";
		$result_web = mysqli_query($conn,"SELECT * FROM security_cam WHERE owner ='$email'");
		if(!mysqli_num_rows($result_web))
		{
			echo"<br><br>";
			echo"<h2>Sorry, No Security Camera Updates Yet</h2>";
			echo"</div>";
		}
		else
		{

			
	    	$count=1;
			while($row = mysqli_fetch_array($result_web))
			{
				echo"<div class=\"col-lg-3 col-md-4 col-xs-6\">";
		        //echo"<a href=\"#\" class=\"d-block mb-4 h-100\">";
		        echo"<img class=\"img-fluid img-thumbnail\" src=".$row['img_path']." alt=\"http://placehold.it/300x300\" hight=\"250\" width=\"250\">";
		        //echo"</a>";
		        echo"<table>";
		        echo"<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>";
		        echo"<tr>";
		        echo"<td>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</td>";
		        echo"<td>Date :</td>";
		        echo"<td>&nbsp;".$row['created_at_date']."</td>";
		        //echo"<td rowspan=2>&nbsp;&nbsp;&nbsp;<i class=\"fa fa-trash\" aria-hidden=\"true\" style=\"color:skyblue;font-size:30;\"></i></td>";
		        echo"<td rowspan=2>&nbsp;&nbsp;&nbsp;<a href=\"index.php?&page=user&subpage=delete_sec_img&id=".$row['img_path']."\"><i class=\"fa fa-trash\" style=\"font-size:24px;color:red\"/></a>";
		        echo"</tr>";
		        echo"<tr>";
		        echo"<td>&nbsp;&nbsp;&nbsp;&nbsp;</td>";
		        echo"<td>Time:</td>";
		        echo"<td>&nbsp;".$row['created_at_time']."</td>";
		        echo"</tr>";
		        echo"<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>";
		        echo"</table>";
		        //echo"Date:	04/09/2017";
		        //echo"<br>";
		        //echo"Time:	12:10AM";
		        //echo"<br>";
		        //echo"<a href=\"\"><i class=\"fa fa-trash-o\" aria-hidden=\"true\" style=\"color:red;font-size:24;\"></i></a>";
				echo"</div>";	    	
			}
			echo"</div>";
		
		}
		mysqli_close($conn);
	}
}
else
{
	header("location:index.php?page=login#loginuser");
}
?>