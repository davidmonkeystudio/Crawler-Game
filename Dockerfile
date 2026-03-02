FROM nginx:alpine

# Copy game files to nginx web root
COPY index.html /usr/share/nginx/html/
COPY style.css /usr/share/nginx/html/
COPY src/ /usr/share/nginx/html/src/

# Cloud Run requires listening on 8080
RUN sed -i 's/listen       80;/listen       8080;/g' /etc/nginx/conf.d/default.conf && \
    sed -i 's/listen  \[::]:80;/listen  [::]:8080;/g' /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
