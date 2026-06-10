from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.exceptions import AuthenticationFailed

class SingleSessionJWTAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        if not user:
            return None
            
        token_session_key = validated_token.get('session_key')
        
        # If user has a session_key set in the database, it must match the token's session_key
        if user.session_key and user.session_key != token_session_key:
            raise AuthenticationFailed(
                'This account has been logged in from another device or session. Please log in again.',
                code='multiple_sessions'
            )
            
        return user
