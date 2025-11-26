# ================================
# 1) NGINX 기반 정적 웹 배포
# ================================
FROM nginx:stable

# 커스텀 nginx 설정 복사
COPY nginx.conf /etc/nginx/nginx.conf

# 정적 파일 복사
COPY . /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]