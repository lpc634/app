# Add these endpoints to src/routes/admin.py in the V3 JOB REPORTS ADMIN ENDPOINTS section

# Helper function for file validation (same as agent routes)
def allowed_file(filename):
    """Check if the file extension is allowed."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in {'pdf', 'jpg', 'jpeg', 'png'}

@admin_bp.route('/admin/v3-reports/upload-photos', methods=['POST'])
@jwt_required()
def admin_upload_v3_report_photos():
    """
    Admin endpoint: Upload photos for a V3 report to S3.
    Accepts multiple files and returns array of S3 URLs.
    """
    try:
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)

        if not user or user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Access denied. Admin role required.'}), 403

        # Check if S3 is configured
        if not s3_client.is_configured():
            return jsonify({
                'error': 'File upload service not available',
                'details': 'S3 storage not configured'
            }), 503

        # Get all uploaded files
        uploaded_files = request.files.getlist('photos')

        if not uploaded_files:
            return jsonify({'error': 'No photos provided'}), 400

        photo_urls = []
        errors = []

        for file in uploaded_files:
            if file.filename == '':
                continue

            if not allowed_file(file.filename):
                errors.append(f"{file.filename}: Invalid file type")
                continue

            # Upload to S3 under v3-reports folder (using admin's ID as agent_id)
            upload_result = s3_client.upload_agent_document(
                agent_id=user.id,
                file=file,
                file_type='v3_report_photo'
            )

            if upload_result.get('success'):
                file_key = upload_result.get('file_key')
                if file_key:
                    photo_urls.append({
                        'url': file_key,
                        'filename': upload_result.get('original_filename'),
                        'upload_date': upload_result.get('upload_date')
                    })
            else:
                errors.append(f"{file.filename}: {upload_result.get('error', 'Upload failed')}")

        if not photo_urls and errors:
            return jsonify({'error': 'All uploads failed', 'details': errors}), 500

        return jsonify({
            'message': f'{len(photo_urls)} photo(s) uploaded successfully',
            'photos': photo_urls,
            'errors': errors if errors else None
        }), 200

    except Exception as e:
        current_app.logger.error(f"Admin photo upload error: {str(e)}")
        return jsonify({'error': 'Failed to upload photos', 'details': str(e)}), 500


@admin_bp.route('/admin/v3-reports/submit', methods=['POST'])
@jwt_required()
def admin_submit_v3_report():
    """
    Admin endpoint: Submit a V3 job report.
    Same functionality as agent endpoint but for admins.
    """
    try:
        from src.models.v3_report import V3JobReport

        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)

        if not user or user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Access denied. Admin role required.'}), 403

        data = request.get_json() or {}
        job_id = data.get('job_id')
        form_type = data.get('form_type')
        report_data = data.get('report_data')
        photo_urls = data.get('photo_urls', [])

        if not form_type:
            return jsonify({'error': 'form_type is required'}), 400

        if not report_data:
            return jsonify({'error': 'report_data is required'}), 400

        # Handle manual reports
        if job_id == 'MANUAL':
            job = None
        else:
            if not job_id:
                return jsonify({'error': 'job_id is required'}), 400

            job = Job.query.get(int(job_id))
            if not job:
                return jsonify({'error': 'Job not found'}), 404

        # Create the V3 report
        v3_report = V3JobReport(
            job_id=job.id if job else None,
            agent_id=user.id,  # Store admin ID
            form_type=form_type,
            status='submitted',
            report_data=report_data,
            photo_urls=photo_urls
        )

        db.session.add(v3_report)
        db.session.commit()

        return jsonify({
            'message': 'Report submitted successfully',
            'report_id': v3_report.id,
            'status': v3_report.status
        }), 201

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Admin report submission error: {str(e)}")
        return jsonify({'error': 'Failed to submit report', 'details': str(e)}), 500
